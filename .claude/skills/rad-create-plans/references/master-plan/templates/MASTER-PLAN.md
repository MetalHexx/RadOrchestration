---
project: "{PROJECT-NAME}"
type: master_plan
status: "draft"
created: "{YYYY-MM-DD}"
total_phases: {N}
total_tasks: {N}
author: "planner-agent"
---

# {PROJECT-NAME} — Master Plan

## Introduction

{Paragraph 1 — 2–3 sentences: what is being built and why, at a glance.}

{Paragraph 2 — 2–3 sentences: shape of the work, headline constraints, what successful delivery looks like.}

## P01: {Phase Title}

{≤3 sentence phase description: what this phase delivers and why it's its own phase.}

**Requirements:** FR-1, FR-2, AD-1, DD-1

**Execution order:**
    T01 → T02 → T03
    T04 (depends on T01)

### P01-T01: Add login form component

{≤2 sentence task description — what the task produces.}

**Task type:** code
**Requirements:** FR-1, DD-1
**Files:**
- Create: `src/components/LoginForm.tsx`
- Test: `src/components/__tests__/LoginForm.test.tsx`

- [ ] **Step 1: Write the failing test (FR-1)**
    ```tsx
    import { render, screen } from '@testing-library/react';
    import { LoginForm } from '../LoginForm';

    test('renders email and password fields', () => {
      render(<LoginForm onSubmit={() => {}} />);
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
    ```
- [ ] **Step 2: Run test, confirm it fails**
    Run: `npm test -- LoginForm.test.tsx`
    Expected: FAIL — `LoginForm` module does not exist yet (FR-1)
- [ ] **Step 3: Implement minimal code (FR-1, DD-1)**
    ```tsx
    import { FormEvent } from 'react';

    type Props = { onSubmit: (email: string, password: string) => void };

    export function LoginForm({ onSubmit }: Props) {
      return (
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            onSubmit(String(data.get('email')), String(data.get('password')));
          }}
        >
          <label>Email<input name="email" type="email" /></label>
          <label>Password<input name="password" type="password" /></label>
          <button type="submit">Sign in</button>
        </form>
      );
    }
    ```
- [ ] **Step 4: Run test, confirm pass**
    Run: `npm test -- LoginForm.test.tsx`
    Expected: PASS (FR-1, DD-1)

### P01-T02: Document login flow in README

{≤2 sentence task description.}

**Task type:** doc
**Requirements:** DD-1
**Files:**
- Modify: `README.md:120-160`

- [ ] **Step 1: Add the login flow section under "Usage"**
    Insert a new subsection titled "Logging in" after the existing "Installation" subsection. Content must describe the email + password form introduced in P01-T01 and link to `src/components/LoginForm.tsx`. (DD-1)
- [ ] **Step 2: Verify the anchor renders**
    Run: `npx markdown-link-check README.md`
    Expected: exit 0, no broken anchors (DD-1)
