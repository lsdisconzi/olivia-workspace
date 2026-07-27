#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const errors = [];

function ensureExists(relativePath, description) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${description} is missing: ${relativePath}`);
    return false;
  }
  return true;
}

function ensureManifestEntry(manifest, id) {
  const entry = manifest.entries?.find((item) => item.id === id);
  if (!entry) {
    errors.push(`Manifest entry missing: ${id}`);
    return false;
  }
  return true;
}

function ensurePathIsResolvable(relativePath, description) {
  const absolutePath = path.join(root, relativePath);
  try {
    fs.realpathSync(absolutePath);
  } catch (error) {
    errors.push(`${description} does not resolve: ${relativePath}`);
    return false;
  }
  return true;
}

const manifestPath = 'agents/agents-groups/la8159/knowledge/manifest.json';
const agentFiles = [
  'agents/agents-groups/la8159/agents/la8159-coordinator.agent.md',
  'agents/agents-groups/la8159/agents/la8159-orchestrator.agent.md',
];
const docs = [
  'agents/agents-groups/la8159/source/PATHS.md',
  'agents/agents-groups/la8159/source/README.md',
];
const links = [
  'agents/agents-groups/la8159/source/la8159',
];

for (const relativePath of [...agentFiles, ...docs, manifestPath]) {
  ensureExists(relativePath, 'Required file');
}

for (const relativePath of links) {
  ensurePathIsResolvable(relativePath, 'Linked source path');
}

if (ensureExists(manifestPath, 'Manifest')) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));
    ensureManifestEntry(manifest, 'la8159.case_data');
    ensureManifestEntry(manifest, 'la8159.violations.validated');
    ensureManifestEntry(manifest, 'la8159.violations.reports');
  } catch (error) {
    errors.push(`Manifest is not valid JSON: ${error.message}`);
  }
}

for (const relativePath of agentFiles) {
  const absolutePath = path.join(root, relativePath);
  const text = fs.readFileSync(absolutePath, 'utf8');
  if (!text.includes('source/PATHS.md') && !text.includes('Path integrity') && !text.includes('Path resolution')) {
    errors.push(`Agent spec does not contain the new path guidance: ${relativePath}`);
  }
}

if (errors.length > 0) {
  console.error('validate-pack failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('validate-pack passed for LA8159 group wiring.');
