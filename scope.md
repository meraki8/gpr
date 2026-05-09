# GPR — Group Project Referee
## Claude Code Scope Document

---

## Problem

In every group project, someone does all the work. Everyone knows it. Nobody says anything. Existing tools like Jira and Notion track tasks but do not hold people accountable. There is no system to prove who contributed, track commitments made in meetings, or automatically surface when someone is ghosting the project. The result is unfair outcomes, resentment, and failed projects.

---

## Solution

GPR is an AI-powered project accountability tool. It sits on top of your existing tools and referees the output. You run your project normally — have meetings, assign tasks, make commitments. GPR watches everything, keeps receipts, and automatically calls out who is delivering and who is not.

No confrontation. No awkward conversations. Just evidence.

**Tagline:** Every project needs a ref.

---

## How It Works

1. Create a group and invite your team
2. Set up a project with a brief, deadline, and any context files
3. GPR generates an AI group contract — every member signs before the project begins
4. Connect your Jira board — GPR watches for overdue and stale tickets automatically via Make.com webhooks
5. After every meeting, paste or upload the transcript — GPR reads it and generates a Match Report
6. Cards are issued automatically — yellow card for falling behind, red card for ghosting, MVP for the top contributor
7. Dashboard shows contribution scores, leaderboard, project health, and weekly AI digest

---

## Core Features

### User and Group Management
- Multi-user application
- Each user can create one or more groups
- Each group can have multiple projects
- Users can be members of multiple groups
- Role: group owner or member

### Project Setup
- Project name, brief, deadline
- Context uploads: files, screenshots, Discord/WhatsApp chat exports
- All context feeds the AI for richer analysis

### AI Contract Generation and Signing
- On project creation, Claude generates a tailored group contract
- Based on project brief, member roles, and deadlines
- Each member signs digitally with timestamp
- Contract saved as PDF and stored against the project
- Members cannot participate until they have signed

### Jira Integration
- Connect a Jira project via OAuth
- Make.com webhooks watch for real-time Jira events
- Overdue ticket, unassigned ticket, or stale ticket triggers GPR analysis
- Claude assesses the event and updates the member's score automatically

### Meeting Transcript Analysis
- Paste transcript as text or upload as file
- Claude reads the full transcript
- Extracts: who spoke, who stayed silent, what commitments were made, what tasks were assigned
- Auto-creates tasks from commitments identified
- Generates Match Report instantly

### Match Report and Cards System
- Per member output:
  - Contribution score
  - Commitments made and delivered
  - Tasks completed vs assigned
  - Cards issued
- Card types:
  - Yellow card — falling behind or missed deadline
  - Red card — ghosting, MIA, overdue by 3+ days
  - MVP trophy — top contributor this period
- Match Report visible to all team members

### Gamified Dashboard
- Project health score
- Contribution leaderboard
- Card history per member
- Sprint progress via Jira data

### Nudge Button
- Any member can nudge any other member
- One click triggers an automated accountability email
- Email written by Claude based on project context and what the member is behind on

### Weekly AI Digest
- Runs automatically every week
- Claude analyses all project activity
- Output: who delivered, who is stalling, risk level, recommended actions
- Sent to all team members via email

---

## Data Model

### Users
- id, name, email, avatar, created_at

### Groups
- id, name, owner_id, created_at

### Group Members
- id, group_id, user_id, role (owner/member), joined_at

### Projects
- id, group_id, name, brief, deadline, health_score, created_at

### Project Members
- id, project_id, user_id, role, contribution_score, signed_contract, signed_at

### Context Files
- id, project_id, file_name, file_url, file_type, uploaded_by, created_at

### Contracts
- id, project_id, content, pdf_url, created_at

### Contract Signatures
- id, contract_id, user_id, signed_at, ip_address

### Transcripts
- id, project_id, uploaded_by, raw_text, file_url, created_at

### Match Reports
- id, project_id, transcript_id, summary, created_at

### Member Reports
- id, match_report_id, user_id, contribution_score, commitments, card_type, notes

### Tasks
- id, project_id, assigned_to, title, description, due_date, status, source (manual/transcript/jira), created_at

### Cards
- id, project_id, user_id, card_type (yellow/red/mvp), reason, created_at

### Nudges
- id, project_id, from_user_id, to_user_id, message, sent_at

### Jira Integrations
- id, project_id, jira_project_key, jira_board_url, webhook_secret, created_at

---

## Tech Stack

- **Framework:** Next.js 14 App Router
- **Styling:** Tailwind CSS — use frontend-design skill for all UI
- **Auth:** Clerk (already configured)
- **Database:** PostgreSQL hosted on Railway
- **ORM:** Prisma
- **Deployment:** Vercel
- **AI:** Claude API via Anthropic SDK
- **File Storage:** Modal or Vercel Blob
- **Webhooks:** Make.com for Jira event watching
- **Email:** Resend for nudge emails and weekly digest
- **PDF Generation:** react-pdf or puppeteer for contract PDFs
- **Context7:** Use context7 for all library documentation lookups

---

## Design Direction

- **Theme:** Sports referee meets SaaS productivity tool
- **Colours:** Black, white, referee red (#DC2626)
- **Tone:** Confident, honest, slightly intimidating, does not sugarcoat
- **Vibe:** Linear meets a football referee
- **Logo:** Referee card or whistle motif
- **Key screen:** Match Report — this is the hero screen, make it dramatic and visual

Follow the frontend-design skill for all UI implementation. Avoid generic AI aesthetics. The Match Report screen in particular must be visually striking and memorable.

---

## GitHub

Repository owner: meraki8

---

## Build Order

1. Project setup, Clerk auth, Prisma schema, Railway DB connection
2. Group and project creation flow
3. Project member invitation and onboarding
4. Contract generation and digital signing
5. Transcript upload and Claude analysis
6. Match report UI and cards system
7. Jira webhook receiver and Make.com integration
8. Gamified dashboard and leaderboard
9. Nudge button and email via Resend
10. Weekly AI digest cron job

---

## Demo Flow

1. Sign up and create a group
2. Create a project with a brief
3. Invite team members
4. Show AI-generated contract and sign it
5. Paste a meeting transcript
6. Hit Analyse
7. Watch match report generate live with cards issued
8. Show Jira integration firing via Make.com
9. Trigger a nudge to a team member

---

## Autonomous Behaviour

GPR must behave as an autonomous agent, not a chatbot. The AI runs on its own schedule and reacts to events without user prompting:

- Make.com watches Jira and fires webhooks to GPR automatically
- Weekly digest runs on a Vercel cron job every Monday
- Ghost detector checks for member inactivity every 24 hours and escalates automatically
- Cards are issued without anyone asking for them

The user configures GPR once and then forgets it exists. It just works.
