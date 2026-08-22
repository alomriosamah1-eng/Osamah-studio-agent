#!/usr/bin/env bash
set -euo pipefail
repos=(
  electron/electron
  microsoft/monaco-editor
  xtermjs/xterm.js
  necolas/react-native-web
  facebook/metro
  expo/expo
  anomalyco/opencode
  NousResearch/hermes-agent
  diegosouzapw/OmniRoute
  deepseek-ai/deepseek-harness
  qpdf/qpdf
  pdfcpu/pdfcpu
  FFmpeg/FFmpeg
  lancedb/lancedb
  qdrant/qdrant
  openai/whisper
  rhasspy/piper
  snakers4/silero-vad
  pixiv/three-vrm
  met4citizen/talkinghead
)
for repo in "${repos[@]}"; do
  gh api -H 'Cache-Control: no-cache' "repos/${repo}" --jq '[.full_name, (.stargazers_count|tostring), .license.spdx_id, .pushed_at, (.archived|tostring), .default_branch] | @tsv'
done
