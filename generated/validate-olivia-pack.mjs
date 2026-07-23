#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const errors = [];
const groupDir = 'agents/agents-groups/olivia';
const manifestPath = `${groupDir}/index.json`;
const knowledgeManifestPath = `${groupDir}/knowledge/manifest.json`;
const agentDir = `${groupDir}/agents`;

function ensureExists(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing: ${relativePath}`);
  }
}

function ensureWorkspaceRelativePath(relativePath) {
  const normalized = relativePath.startsWith('agents/') ? relativePath : `agents/${relativePath}`;
  ensureExists(normalized);
}

function ensureAgentRef(entry) {
  if (!entry.agent_file) {
    errors.push(`Missing agent_file for ${entry.slug}`);
    return;
  }
  const relativePath = entry.agent_file;
  ensureWorkspaceRelativePath(relativePath);
}

ensureExists(manifestPath);
ensureExists(knowledgeManifestPath);

if (fs.existsSync(path.join(root, agentDir))) {
  for (const entry of fs.readdirSync(path.join(root, agentDir))) {
    if (entry.endsWith('.agent.md')) {
      ensureExists(`${groupDir}/agents/${entry}`);
    }
  }
}

try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));
  for (const entry of manifest.agents || []) {
    ensureAgentRef(entry);
  }
  if (manifest.orchestrator?.agent_file) {
    ensureWorkspaceRelativePath(manifest.orchestrator.agent_file);
  }
  if (manifest.coordinator?.agent_file) {
    ensureWorkspaceRelativePath(manifest.coordinator.agent_file);
  }
} catch (error) {
  errors.push(`Invalid group manifest JSON: ${error.message}`);
}

try {
  const knowledge = JSON.parse(fs.readFileSync(path.join(root, knowledgeManifestPath), 'utf8'));
  if (!Array.isArray(knowledge.entries)) {
    errors.push('Knowledge manifest entries must be an array');
  }
} catch (error) {
  errors.push(`Invalid knowledge manifest JSON: ${error.message}`);
}

if (errors.length > 0) {
  console.error('validate-olivia-pack failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('validate-olivia-pack passed.');
