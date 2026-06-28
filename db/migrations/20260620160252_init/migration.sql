-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('local', 'github');

-- CreateEnum
CREATE TYPE "SymbolKind" AS ENUM ('function', 'class', 'method', 'variable');

-- CreateEnum
CREATE TYPE "RefKind" AS ENUM ('read', 'write', 'call', 'def');

-- CreateEnum
CREATE TYPE "StructureKind" AS ENUM ('dir', 'file', 'module');

-- CreateEnum
CREATE TYPE "QueryLevel" AS ENUM ('code', 'module', 'arch');

-- CreateEnum
CREATE TYPE "QueryMode" AS ENUM ('selection', 'followup', 'preset', 'search', 'freeform');

-- CreateEnum
CREATE TYPE "ConceptStatus" AS ENUM ('active', 'pending');

-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('model', 'rule');

-- CreateEnum
CREATE TYPE "EventAction" AS ENUM ('select', 'dim1', 'dim2', 'dim3', 'dim4', 'drill', 'recall');

-- CreateEnum
CREATE TYPE "FocusType" AS ENUM ('folder', 'file', 'module', 'function', 'class', 'variable', 'selection');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('index', 'symbol', 'pregen', 'structure', 'embed');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'done', 'error');

-- CreateEnum
CREATE TYPE "TechKind" AS ENUM ('language', 'framework', 'library', 'tool', 'datastore');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "storage_ref" TEXT,
    "language_summary" JSONB,
    "status" TEXT NOT NULL DEFAULT 'created',
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "rel_path" TEXT NOT NULL,
    "lang" TEXT,
    "size_bytes" INTEGER NOT NULL,
    "loc" INTEGER NOT NULL DEFAULT 0,
    "content_hash" TEXT NOT NULL,
    "is_binary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symbols" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" "SymbolKind" NOT NULL,
    "name" TEXT NOT NULL,
    "qualified_name" TEXT,
    "start_line" INTEGER NOT NULL,
    "end_line" INTEGER NOT NULL,
    "signature" TEXT,

    CONSTRAINT "symbols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symbol_refs" (
    "id" TEXT NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "ref_file_id" TEXT NOT NULL,
    "ref_line" INTEGER NOT NULL,
    "ref_kind" "RefKind" NOT NULL,

    CONSTRAINT "symbol_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_edges" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "caller_symbol_id" TEXT NOT NULL,
    "callee_symbol_id" TEXT NOT NULL,
    "ref_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "call_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_summaries" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "role" TEXT,
    "called_by" JSONB,
    "calls" JSONB,
    "key_symbols" JSONB,
    "model" TEXT,
    "source_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path_scope" TEXT,
    "responsibility" TEXT,
    "business_role" TEXT,
    "is_entry" BOOLEAN NOT NULL DEFAULT false,
    "depends_on" JSONB,
    "file_ids" JSONB,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_analysis" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "architecture_overview" TEXT,
    "tech_stack" JSONB,
    "frameworks" JSONB,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structure_nodes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "kind" "StructureKind" NOT NULL,
    "name" TEXT NOT NULL,
    "rel_path" TEXT,
    "module_id" TEXT,
    "loc" INTEGER NOT NULL DEFAULT 0,
    "size_bytes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "structure_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edge_explanations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source_ref" TEXT NOT NULL,
    "target_ref" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "nl_explanation" TEXT NOT NULL,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edge_explanations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structure_iterations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "missing_files" JSONB,
    "extra_files" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "structure_iterations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_cache" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "focus_type" "FocusType" NOT NULL,
    "focus_ref" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT,
    "model" TEXT,
    "source_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dimension_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_logs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_id" TEXT,
    "level" "QueryLevel" NOT NULL,
    "mode" "QueryMode" NOT NULL,
    "selection" JSONB,
    "snippet" TEXT,
    "question" TEXT,
    "answer" TEXT,
    "parent_id" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "aliases" JSONB,
    "status" "ConceptStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_concept_tags" (
    "query_log_id" TEXT NOT NULL,
    "concept_tag_id" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" "TagSource" NOT NULL DEFAULT 'model',

    CONSTRAINT "query_concept_tags_pkey" PRIMARY KEY ("query_log_id","concept_tag_id")
);

-- CreateTable
CREATE TABLE "interaction_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "session_id" TEXT,
    "action" "EventAction" NOT NULL,
    "focus_type" "FocusType" NOT NULL,
    "focus_ref" TEXT NOT NULL,
    "level" TEXT,
    "dwell_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trajectory_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "session_id" TEXT,
    "order_idx" INTEGER NOT NULL,
    "focus_type" "FocusType" NOT NULL,
    "focus_ref" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trajectory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_concept_stats" (
    "user_id" TEXT NOT NULL,
    "concept_tag_id" TEXT NOT NULL,
    "ask_count" INTEGER NOT NULL DEFAULT 0,
    "dim_counts" JSONB,
    "last_at" TIMESTAMP(3),
    "trend" JSONB,
    "mastery_signal" DOUBLE PRECISION,

    CONSTRAINT "user_concept_stats_pkey" PRIMARY KEY ("user_id","concept_tag_id")
);

-- CreateTable
CREATE TABLE "code_chunks" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "start_line" INTEGER NOT NULL,
    "end_line" INTEGER NOT NULL,
    "kind" TEXT,
    "symbol" TEXT,
    "ast_fingerprint" TEXT,
    "normalized_text" TEXT,

    CONSTRAINT "code_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preset_questions" (
    "id" TEXT NOT NULL,
    "level" "QueryLevel" NOT NULL,
    "scope" TEXT,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "preset_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "progress" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_stack_items" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" "TechKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" TEXT,
    "detected_from" JSONB,
    "usage_refs" JSONB,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tech_stack_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_literacy" (
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "ecosystem_position" TEXT NOT NULL,
    "aliases" JSONB,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tech_literacy_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE INDEX "files_project_id_rel_path_idx" ON "files"("project_id", "rel_path");

-- CreateIndex
CREATE INDEX "symbols_project_id_file_id_idx" ON "symbols"("project_id", "file_id");

-- CreateIndex
CREATE INDEX "symbols_project_id_name_idx" ON "symbols"("project_id", "name");

-- CreateIndex
CREATE INDEX "symbol_refs_symbol_id_idx" ON "symbol_refs"("symbol_id");

-- CreateIndex
CREATE INDEX "call_edges_project_id_idx" ON "call_edges"("project_id");

-- CreateIndex
CREATE INDEX "file_summaries_project_id_file_id_idx" ON "file_summaries"("project_id", "file_id");

-- CreateIndex
CREATE INDEX "modules_project_id_idx" ON "modules"("project_id");

-- CreateIndex
CREATE INDEX "project_analysis_project_id_idx" ON "project_analysis"("project_id");

-- CreateIndex
CREATE INDEX "structure_nodes_project_id_parent_id_idx" ON "structure_nodes"("project_id", "parent_id");

-- CreateIndex
CREATE INDEX "edge_explanations_project_id_source_ref_target_ref_idx" ON "edge_explanations"("project_id", "source_ref", "target_ref");

-- CreateIndex
CREATE INDEX "structure_iterations_project_id_idx" ON "structure_iterations"("project_id");

-- CreateIndex
CREATE INDEX "dimension_cache_project_id_focus_ref_dimension_idx" ON "dimension_cache"("project_id", "focus_ref", "dimension");

-- CreateIndex
CREATE INDEX "query_logs_user_id_created_at_idx" ON "query_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "concept_tags_slug_key" ON "concept_tags"("slug");

-- CreateIndex
CREATE INDEX "query_concept_tags_concept_tag_id_idx" ON "query_concept_tags"("concept_tag_id");

-- CreateIndex
CREATE INDEX "interaction_events_user_id_created_at_idx" ON "interaction_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "interaction_events_project_id_focus_type_idx" ON "interaction_events"("project_id", "focus_type");

-- CreateIndex
CREATE INDEX "trajectory_items_user_id_project_id_idx" ON "trajectory_items"("user_id", "project_id");

-- CreateIndex
CREATE INDEX "code_chunks_project_id_file_id_idx" ON "code_chunks"("project_id", "file_id");

-- CreateIndex
CREATE INDEX "jobs_project_id_idx" ON "jobs"("project_id");

-- CreateIndex
CREATE INDEX "tech_stack_items_project_id_idx" ON "tech_stack_items"("project_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbols" ADD CONSTRAINT "symbols_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbol_refs" ADD CONSTRAINT "symbol_refs_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_concept_tags" ADD CONSTRAINT "query_concept_tags_query_log_id_fkey" FOREIGN KEY ("query_log_id") REFERENCES "query_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_concept_tags" ADD CONSTRAINT "query_concept_tags_concept_tag_id_fkey" FOREIGN KEY ("concept_tag_id") REFERENCES "concept_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
