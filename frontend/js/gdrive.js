// ============================================================================
//  Google Drive backend for Olivia Workspace (Express router)
//  Mount at /api/drive
// ============================================================================

const { Router } = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const stream = require('stream');
const fs = require('fs');
const path = require('path');

const router = Router();

const DEFAULT_GOOGLE_REDIRECT_URI = 'http://127.0.0.1:53682/';

function resolveGoogleOAuthConfig() {
    const configDir = path.resolve(__dirname, '..', '..', 'config');
    const result = { clientId: '', clientSecret: '', redirectUri: DEFAULT_GOOGLE_REDIRECT_URI };
    if (!fs.existsSync(configDir) || !fs.statSync(configDir).isDirectory()) {
        return result;
    }

    for (const entry of fs.readdirSync(configDir)) {
        if (!entry.startsWith('client_secret') || !entry.endsWith('.json')) continue;
        const configPath = path.join(configDir, entry);
        try {
            const fileData = fs.readFileSync(configPath, 'utf8');
            const json = JSON.parse(fileData);
            const candidates = [];
            if (json && typeof json === 'object') {
                if (json.web && typeof json.web === 'object') {
                    candidates.push(json.web);
                }
                if (json.installed && typeof json.installed === 'object') {
                    candidates.push(json.installed);
                }
                candidates.push(json);
            }
            for (const candidate of candidates) {
                const id = String(candidate.client_id || '').trim();
                const secret = String(candidate.client_secret || '').trim();
                const redirect = String(candidate.redirect_uris && candidate.redirect_uris[0] ? candidate.redirect_uris[0] : '').trim();
                if (id && secret) {
                    result.clientId = id;
                    result.clientSecret = secret;
                    if (redirect) {
                        result.redirectUri = redirect;
                    }
                    return result;
                }
            }
        } catch (err) {
            // ignore invalid config files
        }
    }
    return result;
}

const googleOauthConfig = resolveGoogleOAuthConfig();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || googleOauthConfig.clientId;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || googleOauthConfig.clientSecret;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || googleOauthConfig.redirectUri || DEFAULT_GOOGLE_REDIRECT_URI;
const REQUIRED_ENV = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
];
const missingEnv = REQUIRED_ENV.filter(key => !({
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
})[key]);
if (missingEnv.length) {
    console.error('❌ Drive backend: missing environment variables:', missingEnv.join(', '));
    // We'll still create the router, but all endpoints will return 503 with a clear message.
}

// ---------- Google OAuth2 client ----------
const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);

// ---------- Middleware: get authenticated Drive client ----------
async function getDriveClient(req) {
    if (missingEnv.length) {
        throw new Error('Drive backend not configured: missing ' + missingEnv.join(', '));
    }
    if (!req.session || !req.session.googleTokens) {
        throw new Error('Usuário não autenticado no Google Drive.');
    }
    oauth2Client.setCredentials(req.session.googleTokens);
    oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
            req.session.googleTokens = { ...req.session.googleTokens, ...tokens };
        }
    });
    return google.drive({ version: 'v3', auth: oauth2Client });
}

// ---------- Multer for uploads ----------
const upload = multer({ storage: multer.memoryStorage() });

// ---------- Helper: send 503 with config error ----------
function sendConfigError(res, details) {
    res.status(503).json({
        error: 'Serviço indisponível – configuração incompleta.',
        details: details || 'Verifique as variáveis de ambiente do Google Drive.',
    });
}

// ---------- OAuth2 routes ----------
router.get('/auth', (req, res) => {
    if (missingEnv.length) {
        return sendConfigError(res, 'GOOGLE_CLIENT_ID ou SECRET faltando.');
    }
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file'],
        prompt: 'consent',
    });
    res.redirect(authUrl);
});

router.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code');
    try {
        // Explicitly set the first configured redirect URI for token exchange
        oauth2Client.redirectUri = String(process.env.GOOGLE_REDIRECT_URI).split(',')[0].trim();
        const { tokens } = await oauth2Client.getToken(code);
        req.session.googleTokens = tokens;
        res.redirect('/#drive?connected=true');
    } catch (err) {
        console.error('OAuth callback error:', err);
        res.redirect('/#drive?error=oauth_failed');
    }
});

router.get('/status', async (req, res) => {
    try {
        const drive = await getDriveClient(req);
        const about = await drive.about.get({ fields: 'user' });
        const user = about.data.user;
        res.json({ authenticated: true, email: user.emailAddress, name: user.displayName });
    } catch (err) {
        if (err.message.includes('não autenticado') || err.message.includes('missing')) {
            return res.status(401).json({ authenticated: false, error: err.message });
        }
        // Missing env vars → 503
        if (missingEnv.length) {
            return sendConfigError(res, err.message);
        }
        res.status(500).json({ authenticated: false, error: err.message });
    }
});

router.post('/disconnect', (req, res) => {
    req.session.googleTokens = null;
    res.json({ success: true });
});

// ---------- File operations ----------
router.get('/files', async (req, res) => {
    try {
        const drive = await getDriveClient(req);
        const parentId = req.query.parentId || 'root';
        const response = await drive.files.list({
            q: `'${parentId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, modifiedTime, size, parents)',
            orderBy: 'folder,name',
        });
        res.json({ files: response.data.files || [] });
    } catch (err) {
        if (missingEnv.length) return sendConfigError(res, err.message);
        console.error('Erro ao listar arquivos:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const drive = await getDriveClient(req);
        const { file } = req;
        const parentId = req.body.parentId || 'root';
        if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

        const bufferStream = new stream.PassThrough();
        bufferStream.end(file.buffer);
        const media = { mimeType: file.mimetype, body: bufferStream };
        const fileMetadata = { name: file.originalname, parents: [parentId] };
        const driveResponse = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, mimeType, modifiedTime, size',
        });
        res.json(driveResponse.data);
    } catch (err) {
        if (missingEnv.length) return sendConfigError(res, err.message);
        console.error('Erro no upload:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/download', async (req, res) => {
    try {
        const drive = await getDriveClient(req);
        const fileId = req.query.fileId;
        if (!fileId) return res.status(400).json({ error: 'fileId obrigatório' });

        const meta = await drive.files.get({ fileId, fields: 'name, mimeType' });
        const fileName = meta.data.name || 'download';
        const mimeType = meta.data.mimeType || 'application/octet-stream';
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', mimeType);

        const response = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );
        response.data
            .on('end', () => res.end())
            .on('error', (err) => {
                console.error('Stream error:', err);
                res.status(500).end();
            })
            .pipe(res);
    } catch (err) {
        if (missingEnv.length) return sendConfigError(res, err.message);
        console.error('Erro no download:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

router.post('/delete', async (req, res) => {
    try {
        const drive = await getDriveClient(req);
        const fileId = req.query.fileId;
        if (!fileId) return res.status(400).json({ error: 'fileId obrigatório' });
        await drive.files.update({ fileId, requestBody: { trashed: true } });
        res.json({ success: true });
    } catch (err) {
        if (missingEnv.length) return sendConfigError(res, err.message);
        console.error('Erro ao excluir:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/mkdir', async (req, res) => {
    try {
        const drive = await getDriveClient(req);
        const { name, parentId } = req.body;
        if (!name) return res.status(400).json({ error: 'Nome da pasta obrigatório' });
        const fileMetadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : ['root'],
        };
        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: 'id, name, mimeType',
        });
        res.json(folder.data);
    } catch (err) {
        if (missingEnv.length) return sendConfigError(res, err.message);
        console.error('Erro ao criar pasta:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const drive = await getDriveClient(req);
        const about = await drive.about.get({ fields: 'storageQuota' });
        const storageQuota = about.data.storageQuota || {};

        let totalFiles = 0, totalFolders = 0, pageToken = null;
        do {
            const response = await drive.files.list({
                q: "mimeType != 'application/vnd.google-apps.folder' and trashed = false",
                fields: 'nextPageToken, files(id)',
                pageSize: 1000,
                pageToken: pageToken || undefined,
            });
            totalFiles += response.data.files.length;
            pageToken = response.data.nextPageToken;
        } while (pageToken);

        pageToken = null;
        do {
            const response = await drive.files.list({
                q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
                fields: 'nextPageToken, files(id)',
                pageSize: 1000,
                pageToken: pageToken || undefined,
            });
            totalFolders += response.data.files.length;
            pageToken = response.data.nextPageToken;
        } while (pageToken);

        res.json({
            totalFiles,
            totalFolders,
            usedStorage: parseInt(storageQuota.usage || 0, 10),
        });
    } catch (err) {
        if (missingEnv.length) return sendConfigError(res, err.message);
        console.error('Erro ao obter estatísticas:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------- Rclone-style manual credential setup ----------
// Same options as rclone config: drive scope, http://127.0.0.1:53682/ redirect

const RCLONE_REDIRECT_URI = 'http://127.0.0.1:53682/';
const RCLONE_SCOPE = ['https://www.googleapis.com/auth/drive'];

// GET /api/drive/rclone-auth-url — returns the Google OAuth URL (like rclone config)
router.get('/rclone-auth-url', (req, res) => {
    if (missingEnv.length) {
        return sendConfigError(res, 'GOOGLE_CLIENT_ID ou SECRET faltando.');
    }
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: RCLONE_SCOPE,
        prompt: 'consent',
        redirect_uri: RCLONE_REDIRECT_URI,
    });
    res.json({
        url: authUrl,
        instructions: 'Abra o link no navegador, autorize o acesso. O Google redirecionará para http://127.0.0.1:53682/ — copie o código "code=" da barra de endereço e cole abaixo.',
    });
});

// POST /api/drive/rclone-auth-code — exchange the pasted code for tokens
router.post('/rclone-auth-code', async (req, res) => {
    const code = (req.body && req.body.code) ? String(req.body.code).trim() : '';
    if (!code) {
        return res.status(400).json({ error: 'Código de verificação é obrigatório.' });
    }
    if (missingEnv.length) {
        return sendConfigError(res, 'GOOGLE_CLIENT_ID ou SECRET faltando.');
    }
    try {
        oauth2Client.redirectUri = RCLONE_REDIRECT_URI;
        const { tokens } = await oauth2Client.getToken(code);
        req.session.googleTokens = tokens;
        // Also persist to env for the Python server
        const tokenBlob = JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_uri: tokens.token_uri || 'https://oauth2.googleapis.com/token',
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
        });
        process.env.GOOGLE_DRIVE_TOKEN = tokenBlob;
        res.json({ success: true, message: 'Autenticado com sucesso!' });
    } catch (err) {
        console.error('Rclone auth code exchange error:', err);
        res.status(400).json({ error: 'Falha ao trocar o código. Verifique se copiou corretamente e tente novamente.' });
    }
});

module.exports = router;