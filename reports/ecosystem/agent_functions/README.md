# Agent Functions Reference

This directory contains agent-optimized API function definitions.
Each function is documented with all the information an AI agent needs
to understand and correctly invoke the API.

## Quick Start

1. Read `index.json` for a list of all available functions
2. Use `capability_map.json` to find functions by what they do
3. Load individual function files from `functions/` for full details

## File Structure

```
agent_functions/
├── index.json           # Master index of all functions
├── capability_map.json  # Functions organized by capability
├── mcp_tools_catalog.json # MCP-ready tool definitions
├── mcp_tools_ready.json # Ready-only MCP tools (strict gate)
├── validation_report.json # Validation score/checks for every function
├── agent_ready_index.json # Strict ready-only function list
├── README.md            # This file
└── functions/           # Individual function definitions
    ├── {id}_{name}.json
    └── ...
```

## Function Categories

### Agent Control

- **get_agent_v1_openclaude_agents__name__get** (`GET /v1/openclaude/agents/{name}`)
  - Get Agent
- **update_agent_v1_openclaude_agents__name__put** (`PUT /v1/openclaude/agents/{name}`)
  - Update Agent
- **delete_agent_v1_openclaude_agents__name__delete** (`DELETE /v1/openclaude/agents/{name}`)
  - Delete Agent
- **run_agent_v1_openclaude_agents__name__run_post** (`POST /v1/openclaude/agents/{name}/run`)
  - Run Agent
- **validate_agent_v1_openclaude_agents_validate_post** (`POST /v1/openclaude/agents/validate`)
  - Validate Agent
- **import_from_assistant_v1_openclaude_agents_import_from_assistant__assistant_id__post** (`POST /v1/openclaude/agents/import-from-assistant/{assis...`)
  - Import From Assistant
- **export_to_assistant_v1_openclaude_agents_export_to_assistant__name__post** (`POST /v1/openclaude/agents/export-to-assistant/{name}`)
  - Export To Assistant
- **import_from_markdown_v1_openclaude_agents_import_markdown_post** (`POST /v1/openclaude/agents/import-markdown`)
  - Import From Markdown
- **catalog_get_agent_v1_openclaude_catalog_agents__name__get** (`GET /v1/openclaude/catalog/agents/{name}`)
  - Catalog Get Agent
- **import_from_catalog_v1_openclaude_agents_import_from_catalog__name__post** (`POST /v1/openclaude/agents/import-from-catalog/{name}`)
  - Import From Catalog

### Ai

- **chat_endpoint_api_chat_post** (`POST /api/chat`)
  - Chat Endpoint
- **chat_endpoint_juris_api_chat_post** (`POST /juris/api/chat`)
  - Chat Endpoint
- **chat_completions_v1_chat_completions_post** (`POST /v1/chat/completions`)
  - Chat Completions
- **list_assistants_v1_assistants__get** (`GET /v1/assistants/`)
  - List Assistants
- **create_assistant_v1_assistants__post** (`POST /v1/assistants/`)
  - Create Assistant
- **get_assistant_v1_assistants__assistant_id__get** (`GET /v1/assistants/{assistant_id}`)
  - Get Assistant
- **update_assistant_v1_assistants__assistant_id__patch** (`PATCH /v1/assistants/{assistant_id}`)
  - Update Assistant
- **replace_assistant_v1_assistants__assistant_id__put** (`PUT /v1/assistants/{assistant_id}`)
  - Replace Assistant
- **delete_assistant_v1_assistants__assistant_id__delete** (`DELETE /v1/assistants/{assistant_id}`)
  - Delete Assistant
- **chat_with_assistant_v1_assistants__assistant_id__chat_post** (`POST /v1/assistants/{assistant_id}/chat`)
  - Chat With Assistant
- **attach_file_to_assistant_v1_assistants__assistant_id__files_post** (`POST /v1/assistants/{assistant_id}/files`)
  - Attach File To Assistant
- **list_assistant_files_v1_assistants__assistant_id__files_get** (`GET /v1/assistants/{assistant_id}/files`)
  - List Assistant Files
- **detach_file_from_assistant_v1_assistants__assistant_id__files__file_id__delete** (`DELETE /v1/assistants/{assistant_id}/files/{file_id}`)
  - Detach File From Assistant
- **query_assistant_knowledge_v1_assistants__assistant_id__query_knowledge_post** (`POST /v1/assistants/{assistant_id}/query-knowledge`)
  - Query Assistant Knowledge
- **assistant_query_knowledge_v1_knowledge_assistant__assistant_id__query_post** (`POST /v1/knowledge/assistant/{assistant_id}/query`)
  - Assistant Query Knowledge
- **assign_tool_to_assistant_v1_assistants__assistant_id__tools_post** (`POST /v1/assistants/{assistant_id}/tools`)
  - Assign Tool To Assistant
- **deepseek_proxy_v1_assistants__assistant_id__deepseek_post** (`POST /v1/assistants/{assistant_id}/deepseek`)
  - Deepseek Proxy
- **deepseek_engineer_chat_v1_deepseek_engineer_chat_post** (`POST /v1/deepseek-engineer/chat`)
  - Deepseek Engineer Chat
- **deepseek_streaming_proxy_v1_assistants_deepseek_stream_proxy_post** (`POST /v1/assistants/deepseek-stream-proxy`)
  - Deepseek Streaming Proxy

### Crud Create

- **diarization_excerpt_api_diarization_excerpt_post** (`POST /api/diarization/excerpt`)
  - Diarization Excerpt
- **diarization_excerpt_by_path_api_diarization_excerpt_by_path_post** (`POST /api/diarization/excerpt_by_path`)
  - Diarization Excerpt By Path
- **diarization_transcribe_api_diarization_transcribe_post** (`POST /api/diarization/transcribe`)
  - Diarization Transcribe
- **diarization_transcribe_async_api_diarization_transcribe_async_post** (`POST /api/diarization/transcribe/async`)
  - Diarization Transcribe Async
- **diarization_transcribe_guided_api_diarization_transcribe_guided_post** (`POST /api/diarization/transcribe/guided`)
  - Diarization Transcribe Guided
- **diarization_transcribe_guided_async_api_diarization_transcribe_guided_async_post** (`POST /api/diarization/transcribe/guided/async`)
  - Diarization Transcribe Guided Async
- **analyze_transcript_api_transcripts_analyze_post** (`POST /api/transcripts/analyze`)
  - Analyze Transcript
- **index_all_transcripts_api_transcripts_index_all_post** (`POST /api/transcripts/index-all`)
  - Index All Transcripts
- **audit_transcript_route_api_transcripts__transcript_id__audit_post** (`POST /api/transcripts/{transcript_id}/audit`)
  - Audit Transcript Route
- **refine_transcript_route_api_transcripts__transcript_id__refine_post** (`POST /api/transcripts/{transcript_id}/refine`)
  - Refine Transcript Route
- **patch_transcript_route_api_transcripts__transcript_id__patch_post** (`POST /api/transcripts/{transcript_id}/patch`)
  - Patch Transcript Route
- **save_review_api_transcripts__transcript_id__review_save_post** (`POST /api/transcripts/{transcript_id}/review/save`)
  - Save Review
- **index_reviewed_segments_api_transcripts__transcript_id__review_index_post** (`POST /api/transcripts/{transcript_id}/review/index`)
  - Index Reviewed Segments
- **retranscribe_segments_api_transcripts__transcript_id__retranscribe_segments_post** (`POST /api/transcripts/{transcript_id}/retranscribe_segm...`)
  - Retranscribe Segments
- **save_review_legacy_api_transcripts_pinocchio_review__transcript_id__post** (`POST /api/transcripts/pinocchio/review/{transcript_id}`)
  - Save Review Legacy
- **create_project_api_projects_post** (`POST /api/projects`)
  - Create Project
- **add_audio_api_projects__project_id__audios_post** (`POST /api/projects/{project_id}/audios`)
  - Add Audio
- **add_context_doc_api_projects__project_id__context_docs_post** (`POST /api/projects/{project_id}/context_docs`)
  - Add Context Doc
- **add_narrative_api_projects__project_id__narratives_post** (`POST /api/projects/{project_id}/narratives`)
  - Add Narrative
- **link_reference_api_references__canonical_name__link_post** (`POST /api/references/{canonical_name}/link`)
  - Link Reference
- **download_inteiro_teor_api_download_post** (`POST /api/download`)
  - Download Inteiro Teor
- **download_batch_compat_api_download_batch_post** (`POST /api/download-batch`)
  - Download Batch Compat
- **download_inteiro_teor_juris_api_download_post** (`POST /juris/api/download`)
  - Download Inteiro Teor
- **download_batch_compat_juris_api_download_batch_post** (`POST /juris/api/download-batch`)
  - Download Batch Compat
- **docx_rebuild_api_docx_rebuild_post** (`POST /api/docx/rebuild`)
  - Docx Rebuild
- **json_rebuild_api_json_rebuild_post** (`POST /api/json/rebuild`)
  - Json Rebuild
- **storage_rebuild_api_storage_rebuild_post** (`POST /api/storage/rebuild`)
  - Storage Rebuild
- **docx_rebuild_juris_api_docx_rebuild_post** (`POST /juris/api/docx/rebuild`)
  - Docx Rebuild
- **json_rebuild_juris_api_json_rebuild_post** (`POST /juris/api/json/rebuild`)
  - Json Rebuild
- **storage_rebuild_juris_api_storage_rebuild_post** (`POST /juris/api/storage/rebuild`)
  - Storage Rebuild
- **summarize_files_v1_files_summarize_post** (`POST /v1/files/summarize`)
  - Summarize Files
- **upload_file_v1_files_post** (`POST /v1/files`)
  - Upload File
- **create_tool_v1_tools_post** (`POST /v1/tools`)
  - Create Tool
- **execute_tool_v1_tools__tool_name__execute_post** (`POST /v1/tools/{tool_name}/execute`)
  - Execute Tool
- **execute_tool_by_name_v1_tools_execute_post** (`POST /v1/tools/execute`)
  - Execute Tool By Name
- **deep_reasoning_v1_tools_deep_reasoning_post** (`POST /v1/tools/deep_reasoning`)
  - Deep Reasoning
- **generate_prompt_v1_prompt_engineer_generate_post** (`POST /v1/prompt-engineer/generate`)
  - Generate Prompt
- **analyze_needs_v1_prompt_engineer_analyze_post** (`POST /v1/prompt-engineer/analyze`)
  - Analyze Needs
- **generate_variations_v1_prompt_engineer_variations_post** (`POST /v1/prompt-engineer/variations`)
  - Generate Variations
- **optimize_prompt_v1_prompt_engineer_optimize_post** (`POST /v1/prompt-engineer/optimize`)
  - Optimize Prompt
- **evaluate_prompt_v1_prompt_engineer_evaluate_post** (`POST /v1/prompt-engineer/evaluate`)
  - Evaluate Prompt
- **suggest_improvements_v1_prompt_engineer_improve_post** (`POST /v1/prompt-engineer/improve`)
  - Suggest Improvements
- **analyze_transcript_structure_v2_transcripts_analyze_post** (`POST /v2/transcripts/analyze`)
  - Analyze Transcript Structure
- **cypher_v1_neo4j_cypher_post** (`POST /v1/neo4j/cypher`)
  - Cypher
- **rag_context_v1_neo4j_rag_context_post** (`POST /v1/neo4j/rag-context`)
  - Rag Context
- **create_agent_v1_openclaude_agents_post** (`POST /v1/openclaude/agents`)
  - Create Agent
- **create_thread_v1_threads__post** (`POST /v1/threads/`)
  - Create Thread
- **add_message_v1_threads__thread_id__messages_post** (`POST /v1/threads/{thread_id}/messages`)
  - Add Message
- **create_run_v1_threads__thread_id__runs_post** (`POST /v1/threads/{thread_id}/runs`)
  - Create Run
- **attach_file_to_thread_v1_threads__thread_id__files_post** (`POST /v1/threads/{thread_id}/files`)
  - Attach File To Thread
- **regenerate_framework_list_api_frameworks_regenerate_list_post** (`POST /api/frameworks/regenerate-list`)
  - Regenerate Framework List
- **deepseek_gateway_post** (`POST /api/deepseek/{path}`)
  - Deepseek Gateway
- **run_demo_api_run_demo_post** (`POST /api/run-demo`)
  - Run Demo
- **apply_filter_api_filter_post** (`POST /api/filter`)
  - Apply Filter
- **apply_filter_chain_api_filter_chain_post** (`POST /api/filter-chain`)
  - Apply Filter Chain
- **apply_gain_api_effects_gain_post** (`POST /api/effects/gain`)
  - Apply Gain
- **apply_dither_api_effects_dither_post** (`POST /api/effects/dither`)
  - Apply Dither
- **apply_dcshift_api_effects_dcshift_post** (`POST /api/effects/dcshift`)
  - Apply Dcshift
- **apply_overdrive_api_effects_overdrive_post** (`POST /api/effects/overdrive`)
  - Apply Overdrive
- **apply_contrast_api_effects_contrast_post** (`POST /api/effects/contrast`)
  - Apply Contrast
- **apply_flanger_api_effects_flanger_post** (`POST /api/effects/flanger`)
  - Apply Flanger
- **apply_phaser_api_effects_phaser_post** (`POST /api/effects/phaser`)
  - Apply Phaser
- **pitch_shift_api_enhance_pitch_shift_post** (`POST /api/enhance/pitch-shift`)
  - Pitch Shift
- **change_speed_api_enhance_speed_post** (`POST /api/enhance/speed`)
  - Change Speed
- **preemphasis_api_enhance_preemphasis_post** (`POST /api/enhance/preemphasis`)
  - Preemphasis
- **deemphasis_api_enhance_deemphasis_post** (`POST /api/enhance/deemphasis`)
  - Deemphasis
- **change_volume_api_enhance_volume_post** (`POST /api/enhance/volume`)
  - Change Volume
- **apply_fade_api_enhance_fade_post** (`POST /api/enhance/fade`)
  - Apply Fade
- **add_noise_api_enhance_add_noise_post** (`POST /api/enhance/add-noise`)
  - Add Noise
- **compute_spectrogram_api_analysis_spectrogram_post** (`POST /api/analysis/spectrogram`)
  - Compute Spectrogram
- **compute_mel_spectrogram_api_analysis_mel_spectrogram_post** (`POST /api/analysis/mel-spectrogram`)
  - Compute Mel Spectrogram
- **compute_mfcc_api_analysis_mfcc_post** (`POST /api/analysis/mfcc`)
  - Compute Mfcc
- **compute_loudness_api_analysis_loudness_post** (`POST /api/analysis/loudness`)
  - Compute Loudness
- **compute_spectral_centroid_api_analysis_spectral_centroid_post** (`POST /api/analysis/spectral-centroid`)
  - Compute Spectral Centroid
- **detect_pitch_api_analysis_pitch_post** (`POST /api/analysis/pitch`)
  - Detect Pitch
- **separate_sources_api_separate_post** (`POST /api/separate`)
  - Separate Sources
- **voice_activity_detection_api_vad_post** (`POST /api/vad`)
  - Voice Activity Detection
- **resample_audio_api_resample_post** (`POST /api/resample`)
  - Resample Audio
- **apply_convolve_api_effects_convolve_post** (`POST /api/effects/convolve`)
  - Apply Convolve
- **apply_ir_convolve_api_effects_ir_convolve_post** (`POST /api/effects/ir-convolve`)
  - Apply Ir Convolve
- **time_stretch_api_enhance_time_stretch_post** (`POST /api/enhance/time-stretch`)
  - Time Stretch

### Crud Delete

- **delete_project_api_projects__project_id__delete** (`DELETE /api/projects/{project_id}`)
  - Delete Project
- **remove_audio_api_projects__project_id__audios__canonical_name__delete** (`DELETE /api/projects/{project_id}/audios/{canonical_name}`)
  - Remove Audio
- **remove_context_doc_api_projects__project_id__context_docs_delete** (`DELETE /api/projects/{project_id}/context_docs?path={path...`)
  - Remove Context Doc
- **delete_tool_v1_tools__tool_name__delete** (`DELETE /v1/tools/{tool_name}`)
  - Delete Tool
- **delete_thread_v1_threads__thread_id__delete** (`DELETE /v1/threads/{thread_id}`)
  - Delete Thread
- **delete_file_v1_files__file_id__delete** (`DELETE /v1/files/{file_id}`)
  - Delete File
- **deepseek_gateway_delete** (`DELETE /api/deepseek/{path}`)
  - Deepseek Gateway

### Crud List

- **list_parameter_definitions_api_diarization_parameters_get** (`GET /api/diarization/parameters`)
  - List Parameter Definitions
- **list_whisper_models_api_diarization_models_whisper_get** (`GET /api/diarization/models/whisper`)
  - List Whisper Models
- **list_transcripts_api_transcripts_get** (`GET /api/transcripts`)
  - List Transcripts
- **list_csvs_api_transcripts_csv_list_get** (`GET /api/transcripts/csv/list`)
  - List Csvs
- **list_audio_files_api_transcripts_audio_list_get** (`GET /api/transcripts/audio/list`)
  - List Audio Files
- **list_projects_api_projects_get** (`GET /api/projects`)
  - List Projects
- **list_audio_names_api_references_get** (`GET /api/references`)
  - List Audio Names
- **get_narratives_api_references__canonical_name__narratives_get** (`GET /api/references/{canonical_name}/narratives`)
  - Get Narratives
- **get_storage_paths_api_storage_paths_get** (`GET /api/storage/paths`)
  - Get Storage Paths
- **get_storage_paths_juris_api_storage_paths_get** (`GET /juris/api/storage/paths`)
  - Get Storage Paths
- **stats_compat_stats_get** (`GET /stats`)
  - Stats Compat
- **stats_compat_api_stats_get** (`GET /api/stats`)
  - Stats Compat
- **list_courts_courts_get** (`GET /courts`)
  - List Courts
- **list_courts_api_courts_get** (`GET /api/courts`)
  - List Courts
- **stats_compat_juris_stats_get** (`GET /juris/stats`)
  - Stats Compat
- **stats_compat_juris_api_stats_get** (`GET /juris/api/stats`)
  - Stats Compat
- **list_courts_juris_courts_get** (`GET /juris/courts`)
  - List Courts
- **list_courts_juris_api_courts_get** (`GET /juris/api/courts`)
  - List Courts
- **master_index_stats_api_master_index_stats_get** (`GET /api/master-index/stats`)
  - Master Index Stats
- **master_index_document_correlations_api_master_index_document__doc_id__correlations_get** (`GET /api/master-index/document/{doc_id}/correlations`)
  - Master Index Document Correlations
- **master_index_stats_juris_api_master_index_stats_get** (`GET /juris/api/master-index/stats`)
  - Master Index Stats
- **master_index_document_correlations_juris_api_master_index_document__doc_id__correlations_get** (`GET /juris/api/master-index/document/{doc_id}/correlat...`)
  - Master Index Document Correlations
- **list_models_v1_models_get** (`GET /v1/models`)
  - List Models
- **list_files_v1_files_get** (`GET /v1/files`)
  - List Files
- **list_files_in_directory_v1_files_list_get** (`GET /v1/files/list?path={path}`)
  - List Files In Directory
- **list_transcript_files_v1_files_transcripts_get** (`GET /v1/files/transcripts`)
  - List Transcript Files
- **list_law_files_v1_files_laws_get** (`GET /v1/files/laws`)
  - List Law Files
- **list_tools_v1_tools_get** (`GET /v1/tools`)
  - List Tools
- **stats_v1_neo4j_stats_get** (`GET /v1/neo4j/stats`)
  - Stats
- **list_agents_v1_openclaude_agents_get** (`GET /v1/openclaude/agents`)
  - List Agents
- **catalog_list_agents_v1_openclaude_catalog_agents_get** (`GET /v1/openclaude/catalog/agents`)
  - Catalog List Agents
- **list_threads_v1_threads__get** (`GET /v1/threads/`)
  - List Threads
- **list_messages_v1_threads__thread_id__messages_get** (`GET /v1/threads/{thread_id}/messages?limit={limit}`)
  - List Messages
- **debug_routes_debug_routes_get** (`GET /debug-routes`)
  - Debug Routes

### Crud Read

- **health_check__get** (`GET /`)
  - Health Check
- **get_transcript_api_transcripts__transcript_id__get** (`GET /api/transcripts/{transcript_id}`)
  - Get Transcript
- **stream_progress_api_transcripts_stream__job_id__get** (`GET /api/transcripts/stream/{job_id}`)
  - Stream Progress
- **get_review_transcript_api_transcripts_pinocchio_review__transcript_id__get** (`GET /api/transcripts/pinocchio/review/{transcript_id}`)
  - Get Review Transcript
- **get_project_api_projects__project_id__get** (`GET /api/projects/{project_id}`)
  - Get Project
- **get_manifest_api_references__canonical_name__manifest_get** (`GET /api/references/{canonical_name}/manifest`)
  - Get Manifest
- **get_references_api_references__canonical_name__get** (`GET /api/references/{canonical_name}`)
  - Get References
- **get_results_api_results__job_id__get** (`GET /api/results/{job_id}`)
  - Get Results
- **get_results_juris_api_results__job_id__get** (`GET /juris/api/results/{job_id}`)
  - Get Results
- **docx_index_api_docx_index_get** (`GET /api/docx/index`)
  - Docx Index
- **json_index_api_json_index_get** (`GET /api/json/index`)
  - Json Index
- **docx_index_juris_api_docx_index_get** (`GET /juris/api/docx/index`)
  - Docx Index
- **json_index_juris_api_json_index_get** (`GET /juris/api/json/index`)
  - Json Index
- **master_index_documents_api_master_index_documents_get** (`GET /api/master-index/documents?tribunal={tribunal}&ye...`)
  - Master Index Documents
- **master_index_document_api_master_index_document__doc_id__get** (`GET /api/master-index/document/{doc_id}`)
  - Master Index Document
- **master_index_markdown_api_master_index_markdown_get** (`GET /api/master-index/markdown?rebuild={rebuild}`)
  - Master Index Markdown
- **master_index_jurisprudence_api_master_index_jurisprudence_get** (`GET /api/master-index/jurisprudence?rebuild={rebuild}`)
  - Master Index Jurisprudence
- **master_index_jurisprudence_markdown_api_master_index_jurisprudence_markdown_get** (`GET /api/master-index/jurisprudence/markdown?rebuild={...`)
  - Master Index Jurisprudence Markdown
- **master_index_download_file_api_master_index_download_file_get** (`GET /api/master-index/download-file?path={path}`)
  - Master Index Download File
- **master_index_documents_juris_api_master_index_documents_get** (`GET /juris/api/master-index/documents?tribunal={tribun...`)
  - Master Index Documents
- **master_index_document_juris_api_master_index_document__doc_id__get** (`GET /juris/api/master-index/document/{doc_id}`)
  - Master Index Document
- **master_index_markdown_juris_api_master_index_markdown_get** (`GET /juris/api/master-index/markdown?rebuild={rebuild}`)
  - Master Index Markdown
- **master_index_jurisprudence_juris_api_master_index_jurisprudence_get** (`GET /juris/api/master-index/jurisprudence?rebuild={reb...`)
  - Master Index Jurisprudence
- **master_index_jurisprudence_markdown_juris_api_master_index_jurisprudence_markdown_get** (`GET /juris/api/master-index/jurisprudence/markdown?reb...`)
  - Master Index Jurisprudence Markdown
- **master_index_download_file_juris_api_master_index_download_file_get** (`GET /juris/api/master-index/download-file?path={path}`)
  - Master Index Download File
- **read_file_v1_files_read_get** (`GET /v1/files/read?path={path}`)
  - Read File
- **get_audio_file_api_audio__filename__get** (`GET /api/audio/{filename}`)
  - Get Audio File
- **get_tool_v1_tools__tool_name__get** (`GET /v1/tools/{tool_name}`)
  - Get Tool
- **get_prompt_examples_v1_prompt_engineer_examples_get** (`GET /v1/prompt-engineer/examples?category={category}`)
  - Get Prompt Examples
- **get_ecosystem_report_v1_ecosystem_report_get** (`GET /v1/ecosystem/report`)
  - Get latest ecosystem MCP report
- **get_ecosystem_metadata_v1_ecosystem_metadata_get** (`GET /v1/ecosystem/metadata`)
  - Get ecosystem metadata JSON
- **get_thread_v1_threads__thread_id__get** (`GET /v1/threads/{thread_id}`)
  - Get Thread
- **debug_schema_debug_schema_get** (`GET /debug-schema`)
  - Debug Schema
- **get_file_content_v1_files__file_id__content_get** (`GET /v1/files/{file_id}/content`)
  - Get File Content
- **deepseek_gateway_get** (`GET /api/deepseek/{path}`)
  - Deepseek Gateway
- **get_audio_api_audio__session_id__get** (`GET /api/audio/{session_id}`)
  - Get Audio
- **get_info_api_info_get** (`GET /api/info`)
  - Get Info

### Crud Update

- **update_transcript_metadata_api_transcripts__transcript_id__put** (`PUT /api/transcripts/{transcript_id}`)
  - Update Transcript Metadata
- **update_project_api_projects__project_id__patch** (`PATCH /api/projects/{project_id}`)
  - Update Project
- **deepseek_gateway_put** (`PUT /api/deepseek/{path}`)
  - Deepseek Gateway

### Data Ingestion

- **import_transcripts_api_transcripts_import_post** (`POST /api/transcripts/import`)
  - Import Transcripts
- **import_csv_api_transcripts_csv_import_post** (`POST /api/transcripts/csv/import`)
  - Import Csv
- **upload_reference_api_references__canonical_name__upload_post** (`POST /api/references/{canonical_name}/upload`)
  - Upload Reference
- **upload_file_api_upload_post** (`POST /api/upload`)
  - Upload File
- **upload_file_juris_api_upload_post** (`POST /juris/api/upload`)
  - Upload File
- **master_index_rebuild_api_master_index_rebuild_post** (`POST /api/master-index/rebuild?force_ingest={force_inge...`)
  - Master Index Rebuild
- **master_index_rebuild_juris_api_master_index_rebuild_post** (`POST /juris/api/master-index/rebuild?force_ingest={forc...`)
  - Master Index Rebuild
- **upload_pdf_api_ingest_pdf_upload_post** (`POST /api/ingest-pdf/upload`)
  - Upload Pdf
- **process_pdf_api_ingest_pdf_process_post** (`POST /api/ingest-pdf/process`)
  - Process Pdf
- **upload_pdf_juris_api_ingest_pdf_upload_post** (`POST /juris/api/ingest-pdf/upload`)
  - Upload Pdf
- **process_pdf_juris_api_ingest_pdf_process_post** (`POST /juris/api/ingest-pdf/process`)
  - Process Pdf
- **upload_transcript_file_v1_files_upload_transcript_post** (`POST /v1/files/upload/transcript`)
  - Upload Transcript File
- **upload_law_file_v1_files_upload_law_post** (`POST /v1/files/upload/law`)
  - Upload Law File
- **ingest_file_v1_knowledge_ingest_file_post** (`POST /v1/knowledge/ingest/file`)
  - Ingest File
- **analyze_document_structure_v1_ingestion_analyze_document_structure_post** (`POST /v1/ingestion/analyze-document-structure`)
  - Analyze Document Structure
- **ingest_from_file_path_legal_ingestion_ingest_file_post** (`POST /legal-ingestion/ingest-file?file_path={file_path}`)
  - Ingest From File Path
- **ingest_legal_file_enhanced_v2_legal_ingestion_ingest_legal_file_enhanced_post** (`POST /v2/legal-ingestion/ingest-legal-file-enhanced`)
  - Ingest Legal File Enhanced
- **ingest_legal_folder_v2_legal_ingestion_ingest_legal_folder_post** (`POST /v2/legal-ingestion/ingest-legal-folder`)
  - Ingest Legal Folder
- **analyze_document_structure_v2_legal_ingestion_analyze_document_structure_post** (`POST /v2/legal-ingestion/analyze-document-structure`)
  - Analyze Document Structure
- **ingest_transcript_enhanced_v2_transcripts_ingest_enhanced_post** (`POST /v2/transcripts/ingest-enhanced`)
  - Ingest Transcript Enhanced
- **ingest_transcript_json_v2_transcripts_ingest_json_post** (`POST /v2/transcripts/ingest-json`)
  - Ingest Transcript Json
- **upload_to_session_api_upload_session_post** (`POST /api/upload-session`)
  - Upload To Session

### Memory

- **index_transcript_api_transcripts__transcript_id__index_post** (`POST /api/transcripts/{transcript_id}/index?collection=...`)
  - Index Transcript
- **list_transcripts_review_api_transcripts_review_list_get** (`GET /api/transcripts/review/list?collection={collectio...`)
  - List Transcripts Review
- **qdrant_collections_api_admin_qdrant_collections_get** (`GET /api/admin/qdrant-collections`)
  - Qdrant Collections
- **qdrant_collections_juris_api_admin_qdrant_collections_get** (`GET /juris/api/admin/qdrant-collections`)
  - Qdrant Collections
- **master_index_pause_api_master_index_pause_post** (`POST /api/master-index/pause?collection={collection}`)
  - Master Index Pause
- **master_index_resume_api_master_index_resume_post** (`POST /api/master-index/resume?collection={collection}`)
  - Master Index Resume
- **master_index_pause_juris_api_master_index_pause_post** (`POST /juris/api/master-index/pause?collection={collecti...`)
  - Master Index Pause
- **master_index_resume_juris_api_master_index_resume_post** (`POST /juris/api/master-index/resume?collection={collect...`)
  - Master Index Resume
- **connect_to_qdrant_v1_qdrant_connect_post** (`POST /v1/qdrant/connect`)
  - Check Qdrant Connection
- **list_collections_v1_qdrant_collections_get** (`GET /v1/qdrant/collections`)
  - List All Collections
- **create_collection_v1_qdrant_collections_post** (`POST /v1/qdrant/collections`)
  - Create a New Collection
- **get_collection_summary_v1_qdrant_collections__collection_name__summary_get** (`GET /v1/qdrant/collections/{collection_name}/summary`)
  - Get Collection Statistics
- **structured_ingest_v1_qdrant_collections_structured_ingest_post** (`POST /v1/qdrant/collections/structured_ingest`)
  - Ingest structured data
- **ensure_legal_indexes_v1_qdrant_collections__collection_name__ensure_indexes_post** (`POST /v1/qdrant/collections/{collection_name}/ensure-in...`)
  - Ensure Legal Indexes
- **delete_collection_v1_qdrant_collections__collection_name__delete** (`DELETE /v1/qdrant/collections/{collection_name}`)
  - Delete a Collection
- **ingest_files_v1_qdrant_collections__collection_name__ingest_post** (`POST /v1/qdrant/collections/{collection_name}/ingest`)
  - Ingest Files into a Collection
- **embed_case_directory_v1_qdrant_embed_case_directory_post** (`POST /v1/qdrant/embed-case-directory`)
  - Scan, create, and embed a full case directory
- **embed_project_code_v1_qdrant_embed_project_code_post** (`POST /v1/qdrant/embed-project-code`)
  - Generate code summaries and index into dev-code collection
- **query_points_v1_qdrant_query_post** (`POST /v1/qdrant/query`)
  - Query a Collection with Vector
- **search_qdrant_v1_qdrant_qdrant_search_post** (`POST /v1/qdrant/qdrant/search?collection_name={collecti...`)
  - Search Qdrant
- **search_with_text_v1_qdrant_search_post** (`POST /v1/qdrant/search`)
  - Search a Collection with Text
- **query_with_vector_v1_qdrant_collections__collection_name__query_vector_post** (`POST /v1/qdrant/collections/{collection_name}/query/vec...`)
  - Query with Vector
- **clear_collection_v1_knowledge_collection__collection_name__clear_delete** (`DELETE /v1/knowledge/collection/{collection_name}/clear`)
  - Clear Collection
- **get_collection_stats_v1_knowledge_collection__collection_name__stats_get** (`GET /v1/knowledge/collection/{collection_name}/stats`)
  - Get Collection Stats
- **ingest_directory_v1_ingestion_ingest_directory_post** (`POST /v1/ingestion/ingest-directory?directory_path={dir...`)
  - Ingest Directory
- **ingest_file_v1_ingestion_ingest_file_post** (`POST /v1/ingestion/ingest-file?collection_name={collect...`)
  - Ingest File
- **ingest_legal_file_v1_ingestion_ingest_legal_file_post** (`POST /v1/ingestion/ingest-legal-file?collection_name={c...`)
  - Ingest Legal File
- **search_documents_v1_ingestion_search_post** (`POST /v1/ingestion/search?collection_name={collection_n...`)
  - Search Documents
- **get_collection_info_v1_ingestion_collections__collection_name__info_get** (`GET /v1/ingestion/collections/{collection_name}/info`)
  - Get Collection Info
- **upload_and_ingest_csv_legal_ingestion_upload_csv_post** (`POST /legal-ingestion/upload-csv?collection_name={colle...`)
  - Upload And Ingest Csv
- **search_legal_documents_legal_ingestion_search__collection_name__post** (`POST /legal-ingestion/search/{collection_name}`)
  - Search Legal Documents
- **list_collections_legal_ingestion_collections_get** (`GET /legal-ingestion/collections`)
  - List Collections
- **get_collection_info_legal_ingestion_collection__collection_name__info_get** (`GET /legal-ingestion/collection/{collection_name}/info`)
  - Get Collection Info
- **delete_collection_legal_ingestion_collection__collection_name__delete** (`DELETE /legal-ingestion/collection/{collection_name}`)
  - Delete Collection

### Search

- **search_transcripts_api_transcripts_search_post** (`POST /api/transcripts/search`)
  - Search Transcripts
- **start_search_api_search_post** (`POST /api/search`)
  - Start Search
- **search_status_api_search_status__job_id__get** (`GET /api/search/status/{job_id}`)
  - Search Status
- **list_search_history_api_search_history_get** (`GET /api/search/history?limit={limit}`)
  - List Search History
- **get_search_history_file_api_search_history__filename__get** (`GET /api/search/history/{filename}`)
  - Get Search History File
- **start_search_juris_api_search_post** (`POST /juris/api/search`)
  - Start Search
- **search_status_juris_api_search_status__job_id__get** (`GET /juris/api/search/status/{job_id}`)
  - Search Status
- **list_search_history_juris_api_search_history_get** (`GET /juris/api/search/history?limit={limit}`)
  - List Search History
- **get_search_history_file_juris_api_search_history__filename__get** (`GET /juris/api/search/history/{filename}`)
  - Get Search History File
- **master_index_semantic_search_api_master_index_search_post** (`POST /api/master-index/search`)
  - Master Index Semantic Search
- **master_index_semantic_search_juris_api_master_index_search_post** (`POST /juris/api/master-index/search`)
  - Master Index Semantic Search
- **knowledge_query_v1_knowledge_query_post** (`POST /v1/knowledge/query`)
  - Knowledge Query

### System

- **health_health_get** (`GET /health`)
  - Health
- **get_progress_status_api_transcripts_status__job_id__get** (`GET /api/transcripts/status/{job_id}`)
  - Get Progress Status
- **download_status_api_download_status__job_id__get** (`GET /api/download/status/{job_id}`)
  - Download Status
- **download_status_juris_api_download_status__job_id__get** (`GET /juris/api/download/status/{job_id}`)
  - Download Status
- **health_api_health_get** (`GET /api/health`)
  - Health
- **health_juris_api_health_get** (`GET /juris/api/health`)
  - Health
- **health_legacy_juris_health_get** (`GET /juris/health`)
  - Health Legacy
- **health_v1_neo4j_health_get** (`GET /v1/neo4j/health`)
  - Health

## Function Schema

Each function JSON contains:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Human-readable name |
| `method` | HTTP method (GET, POST, etc.) |
| `url_pattern` | URL with parameter placeholders |
| `description` | What this function does |
| `category` | Functional category |
| `path_params` | URL path parameters |
| `query_params` | URL query parameters |
| `body_schema` | Request body structure |
| `headers` | Required headers |
| `response_type` | Expected response format |
| `prerequisites` | Functions to call first |
| `related_functions` | Commonly used together |
| `use_cases` | When to use this function |
| `capabilities` | What this enables |

## Workflow Composition

See `capability_map.json` for pre-defined workflows that combine
multiple functions to accomplish common tasks.
