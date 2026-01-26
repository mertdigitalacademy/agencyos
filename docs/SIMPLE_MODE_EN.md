# AgencyOS - Simple Mode Documentation

## Overview

AgencyOS now offers two distinct user experiences:

- **Simple Mode**: "Click button, it works" simplicity for non-technical agency owners
- **Advanced Mode**: Full feature access for technical users

## Simple Mode Features

### 📱 Simplified Navigation (5 Items)
- 🏠 **Home** - Quick overview and metrics
- 🤖 **AI Coach** - AI assistant
- 📁 **Projects** - Project management
- 💰 **Money** - Revenue calculator and "what-if" scenarios
- ⚡ **Setup** - 2-step simple setup

### 🎯 New User Journey

**Old:** 10-15 minutes, 15-20 clicks, 7 integrations
**New:** 2 minutes, 5 clicks, only 2 basic settings

#### Step 1: Quick Setup (60 seconds)
1. Choose language (🇹🇷 Turkish / 🇺🇸 English)
2. Select interface mode (✨ Simple / 🚀 Advanced)

#### Step 2: AI Key (Optional)
- Add Gemini API key (or skip for demo)
- Auto-loads demo projects

#### Result
- Time to first value: < 2 minutes
- Ready-to-use demo project instantly
- AI-suggested workflows

## New Components

### 🏠 Home.tsx
**Purpose:** Main dashboard - replaces complex Revenue Journey

**Features:**
- 3 core metrics: Pipeline | Active | Billed
- AI-powered "Next Step" suggestion
- Quick actions: New Project, Ask AI Coach
- Recent 5 projects list
- Empty state guidance

**Location:** `components/Home.tsx` (200 lines)

### 💰 Money.tsx
**Purpose:** Revenue planning and calculation

**Features:**
- Revenue calculator (MRR target, average price, conversion rates)
- "What if" scenarios: One-click to 5K, 10K, 20K targets
- Visual results (how many clients, proposals, leads needed)

**Location:** `components/Money.tsx` (246 lines)

### 📁 DashboardSimple.tsx
**Purpose:** Simple project list

**Features:**
- 4 KPI cards (Total, Active, Revenue, Workflows)
- Filters (All | Active | Live)
- Lead list
- Project cards (status, revenue, workflow count)

**Location:** `components/DashboardSimple.tsx` (280 lines)

### 🏛️ CouncilRoomSimple.tsx
**Purpose:** AI Council decisions - complexity hidden

**Features:**
- 4 decision type selection (Strategy, Risk, Launch, Review)
- Custom question input
- Simple results display (summary instead of complex board)
- Pricing info (if available)
- "Create Invoice" button for approved decisions

**Location:** `components/CouncilRoomSimple.tsx` (337 lines)

### ⚡ SetupWizardSimple.tsx
**Purpose:** 2-step simple setup

**Old:** 945 lines, 5 steps, 7 integrations
**New:** 340 lines, 2 steps, 2 basic settings

**Steps:**
1. Language + UI mode selection
2. Gemini API key (optional)

**Location:** `components/SetupWizardSimple.tsx` (340 lines)

## 🤖 New AI Features

### Multimodal Intake (Image/Video Analysis)
**What:** Clients can upload logos, website screenshots, or videos - AI auto-analyzes

**Features:**
- Extract brand colors (hex codes)
- Visual style analysis (modern, minimalist, corporate, etc.)
- Industry detection
- Video transcript generation
- Auto-fill forms

**Tech:** Gemini 2.0 Flash multimodal API
**Location:** `server/lib/geminiVision.ts` (188 lines)

**Usage:**
```typescript
// File upload in IntakeWizard
<input type="file" accept="image/*,video/*" multiple />

// Auto-analysis
POST /api/intake/analyze-visual
{
  file: base64Data,
  mimeType: "image/png"
}

// Result
{
  brandColors: ["#FF5733", "#3498DB"],
  visualStyle: "Modern and minimalist",
  industry: "E-commerce",
  requirements: ["Online sales", "Payment integration"],
  confidence: 0.85
}
```

### Auto Workflow Suggestions
**What:** AI analyzes project brief, automatically finds and suggests top 3 best-fit workflows

**How it Works:**
1. Extract keywords from project brief
2. AI search in workflow catalog
3. Calculate relevance score (0-1)
4. Show top 3 with reasons/rationale
5. One-click installation

**Tech:** `services/autoWorkflow.ts` (239 lines)

**Features:**
- Industry matching
- Tool/technology matching
- Goal matching
- Complexity preference (simple-first)
- Confidence score (>60% = one-click install)

**Usage:**
```typescript
import { suggestWorkflows } from './services/autoWorkflow';

// After project creation
const suggestions = await suggestWorkflows(project);

// Display
<WorkflowSuggestionCard
  suggestions={suggestions}
  onInstall={(id) => installWorkflow(id)}
  onInstallAll={() => installAll(suggestions)}
/>
```

## Design System

### Consistent Design Language
All simple mode components follow the same design rules:

**Colors:**
- Background: `bg-gray-800/50` + `border-gray-700`
- CTA Buttons: `bg-blue-600 hover:bg-blue-700`
- Secondary Buttons: `bg-gray-700 hover:bg-gray-600`
- Success: `bg-green-600`, `text-green-400`
- Warning: `bg-yellow-900/20`, `text-yellow-300`

**Shapes:**
- All cards: `rounded-lg`
- Buttons: `rounded-lg` or `rounded-full` (for status indicators)

**Spacing:**
- Between sections: `space-y-8`
- Sub-sections: `space-y-4`
- Card padding: `p-6` or `p-8`

**Icons:**
- Large headers: `text-6xl`
- Section headers: `text-3xl` or `text-4xl`
- Small markers: `text-2xl`

**Metric Cards:**
```tsx
<div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center space-y-2">
  <div className="text-4xl">📋</div>
  <div className="text-3xl font-bold text-blue-400">{value}</div>
  <div className="text-sm text-gray-400">{label}</div>
</div>
```

## Code Organization

### New File Structure
```
components/
├── Home.tsx                    (200 lines) - Simple home page
├── Money.tsx                   (246 lines) - Revenue calculator
├── DashboardSimple.tsx         (280 lines) - Simple project list
├── CouncilRoomSimple.tsx       (337 lines) - Simple AI council
├── SetupWizardSimple.tsx       (340 lines) - 2-step setup
├── WorkflowSuggestionCard.tsx  (180 lines) - AI workflow suggestions
└── ... (existing components)

services/
├── autoWorkflow.ts             (239 lines) - AI workflow suggestion
├── onboarding.ts               (existing) - UI mode management
└── ... (existing services)

server/lib/
├── geminiVision.ts             (188 lines) - Multimodal analysis
└── ... (existing libs)
```

### App.tsx Changes

**Entry from Landing:**
```typescript
const onboarding = readOnboardingState();
setUiMode(onboarding.uiMode);

if (!onboarding.setupCompleted) {
  setCurrentView(View.SETUP);
} else {
  // HOME in simple mode, JOURNEY in advanced mode
  setCurrentView(onboarding.uiMode === 'simple' ? View.HOME : View.JOURNEY);
}
```

**Setup component selection:**
```typescript
{currentView === View.SETUP && (
  uiMode === 'simple' ? (
    <SetupWizardSimple ... />
  ) : (
    <SetupWizard ... />
  )
)}
```

**Breadcrumb navigation:**
```typescript
// Return to HOME in simple mode, JOURNEY in advanced mode
setCurrentView(uiMode === 'simple' ? View.HOME : View.JOURNEY);
```

## Hiding Advanced Features

### Hidden in Simple Mode
- ❌ Revenue Journey (1,406 line complex dashboard)
- ❌ Workflow Catalog (manual search)
- ❌ Board Studio (complex council view)
- ❌ Documents page
- ❌ Advanced settings
- ❌ 6 integration status (SuiteCRM, InvoiceShelf, Documenso, Infisical, Apify, Postgres)
- ❌ Technical jargon and metrics
- ❌ n8n status header

### Visible in Simple Mode
- ✅ HOME - Home page (metrics + quick actions)
- ✅ ASSISTANT - AI Coach
- ✅ PROJECTS - Simple project list
- ✅ MONEY - Revenue calculator
- ✅ SETUP - 2-step setup
- ✅ Gemini API (single integration)
- ✅ AI CEO status header

### Future: Progressive Disclosure
Planned but not yet implemented:

```typescript
// Features unlock as user progresses
function calculateProgressLevel(user) {
  if (user.completedTasks >= 10 && user.projects >= 5 && user.revenue >= 5000) {
    return 'advanced';  // All 11 nav items
  }
  if (user.completedTasks >= 5 && user.projects >= 2) {
    return 'intermediate';  // 7 nav items
  }
  return 'beginner';  // Only 5 nav items
}
```

## API Endpoints

### New Endpoint: Visual Analysis
```
POST /api/intake/analyze-visual
Content-Type: application/json

{
  "file": "base64_encoded_data",
  "mimeType": "image/png"
}

Response:
{
  "brandColors": ["#FF5733"],
  "visualStyle": "Modern",
  "industry": "E-commerce",
  "requirements": ["Online sales"],
  "confidence": 0.85
}
```

## Test Scenarios

### 1. First User Journey (Simple Mode)
1. Landing page → "Start My Agency"
2. Setup Step 1: Select language (EN), Select mode (Simple)
3. Setup Step 2: Skip API key
4. HOME page opens, demo project shown
5. Click "New Project"
6. Upload logo in Intake wizard → Auto-analysis
7. Create project
8. AI workflow suggestions shown → "Install All"
9. Return to HOME → Metrics updated

**Duration:** < 2 minutes
**Clicks:** 5-7

### 2. Revenue Planning
1. HOME → MONEY button
2. Enter target MRR (e.g., $10,000)
3. Calculate → See results
4. "What if I reach $10K?" → See scenario
5. Plan shown: X clients × $Y

### 3. AI Council Decision
1. PROJECTS → Select project
2. "Ask AI Team" button
3. CouncilRoomSimple opens
4. Select gate (Strategy)
5. "Ask AI Team"
6. Simple decision shown (summary + pricing)
7. "Create Invoice" (if approved)

### 4. Multimodal Intake
1. New Project → Intake
2. Upload file button → Select logo
3. AI analyzes → Extracts brand colors
4. Form auto-fills
5. Upload video → Transcript generated
6. Create project

## Performance Metrics

### Build
- ✅ Success: 865ms
- ⚠️ Bundle size: 664.67 KB (optimization recommended)
- ✅ 0 TypeScript errors
- ✅ 56 modules

### Target Metrics
- Time to first value: < 2 minutes ✅
- Clicks to first project: < 5 ✅
- Setup steps: 2-3 ✅
- Required env vars: 0-1 (Gemini API optional) ✅
- Navigation items: 5 (simple mode) ✅

## Success Criteria: "Is it Simple Enough?"

### Tests
1. ✅ **Mom Test:** Can a non-technical person complete setup?
   - YES - 2 steps, visual guidance, demo mode

2. ✅ **5-Year-Old Test:** Can you explain the UI to a 5-year-old?
   - "Click button, AI helps you make money"

3. ✅ **Frustration Test:** Will user say "I don't know what to do"?
   - NO - "Next Step" always shown

4. ✅ **Jargon Test:** Will user see confusing technical terms?
   - NO - Zero jargon in simple mode

5. ✅ **Success Test:** Can user complete first revenue cycle without docs?
   - YES - Demo + AI suggestions + quick actions

## Future Improvements

### Week 4 (Not Yet Implemented)
- [ ] Progressive disclosure system
- [ ] Advanced settings page (full control of 6 integrations)
- [ ] "New Feature Unlocked" modals
- [ ] User progress tracking

### Optimizations
- [ ] Code splitting (reduce bundle size)
- [ ] Lazy loading (load components on demand)
- [ ] Cache strategy (API results)
- [ ] Service Worker (offline support)

## Important Notes

### Switching UI Mode
Users can change UI mode via Sidebar:
- Simple → Advanced: All features unlock
- Advanced → Simple: Simplified view

### Data Compatibility
- ✅ All data is the same in both modes
- ✅ No data loss when switching modes
- ✅ Projects, workflows, decisions are shared

### Backward Compatibility
- ✅ Old components still exist (for advanced mode)
- ✅ API unchanged, only new endpoint added
- ✅ All existing features work in advanced mode

## Troubleshooting

### "AI suggestions not working"
- Is Gemini API key correct?
- Does `server/.env` have `GEMINI_API_KEY`?
- Is backend running? (`npm run server`)

### "Visual analysis not working"
- Is file size < 20MB?
- Is format supported? (PNG, JPG, MP4, WEBM)
- Do you have Gemini 2.0 Flash API access?

### "Setup cannot complete"
- Any errors in browser console?
- Is `data/` folder writable?
- Are ports 7000/7001 available?

## Contributing

This simplification work is a 4-week plan. Currently **Week 3 completed**.

### Completed Work
- ✅ Week 1: Backend refactoring, simple setup, simple navigation, home page
- ✅ Week 2: Multimodal intake, auto workflow suggestions
- ✅ Week 3: Money page, simple projects, simple AI council

### Remaining Work
- ⏳ Week 4: Progressive disclosure, hide integrations, final polish

---

**Created:** 2025-12-31
**Version:** 1.0
**Status:** Active development
