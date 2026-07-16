-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootPath" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "githubRepo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "branch" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "bashCount" INTEGER NOT NULL DEFAULT 0,
    "testCount" INTEGER NOT NULL DEFAULT 0,
    "testSuccessCount" INTEGER NOT NULL DEFAULT 0,
    "testFailureCount" INTEGER NOT NULL DEFAULT 0,
    "subAgentCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "parentAgentId" TEXT,
    "agentType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "spawnedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "parentAgentId" TEXT,
    "displayName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "toolName" TEXT,
    "status" TEXT NOT NULL,
    "target" TEXT,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "seq" INTEGER NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT,
    "repo" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "action" TEXT,
    "actor" TEXT,
    "url" TEXT,
    "payloadSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyState" (
    "projectId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experiencePoints" INTEGER NOT NULL DEFAULT 0,
    "unlockedFeatures" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "CompanyState_pkey" PRIMARY KEY ("projectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_rootPath_key" ON "Project"("rootPath");

-- CreateIndex
CREATE INDEX "Session_projectId_startedAt_idx" ON "Session"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "Agent_sessionId_idx" ON "Agent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_sessionId_internalId_key" ON "Agent"("sessionId", "internalId");

-- CreateIndex
CREATE INDEX "Event_sessionId_seq_idx" ON "Event"("sessionId", "seq");

-- CreateIndex
CREATE INDEX "Event_agentId_timestamp_idx" ON "Event"("agentId", "timestamp");

-- CreateIndex
CREATE INDEX "GithubEvent_projectId_createdAt_idx" ON "GithubEvent"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubEvent" ADD CONSTRAINT "GithubEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubEvent" ADD CONSTRAINT "GithubEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyState" ADD CONSTRAINT "CompanyState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
