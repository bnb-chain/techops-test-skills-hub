# Contributing to Skills Hub

Submitting a skill takes about 2 minutes. You create one JSON file — the rest is automated.

---

## Submission Format

Create a file named `<skillname>-metadata.json` in the `skills/` folder.

Use [`skills/_TEMPLATE-metadata.json`](skills/_TEMPLATE-metadata.json) as your starting point:

```json
{
  "name": "My Skill Name",
  "github_url": "https://github.com/owner/repo",
  "category": ["category1", "category2"],
  "description": "One or two sentences describing what this skill does and when to use it."
}
```

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | No | Display name — defaults to filename if omitted |
| `github_url` | string | **Yes** | Must be a public GitHub repository URL |
| `category` | string[] | **Yes** | Array of tags (e.g. `["git", "automation"]`) |
| `description` | string | **Yes** | What it does; one or two sentences |

> The filename (minus `-metadata.json`) becomes the skill's identifier.
> Example: `my-skill-metadata.json` → identifier `my-skill`

---

## Steps

### 1. Fork & clone

```bash
git clone https://github.com/<your-username>/skills-hub
cd skills-hub
```

### 2. Create your submission file

```
skills/my-skill-metadata.json
```

### 3. Open a pull request

Push your branch and open a PR against `main`. Keep PRs to **one skill per submission**.

---

## What Happens Automatically

Once your PR is opened, the workflow enriches your file in-place by injecting:

| Field | Source |
|-------|--------|
| `owner.username` | GitHub API |
| `owner.display_name` | GitHub API |
| `owner.type` | GitHub API (`User` or `Organization`) |
| `owner.profile_url` | GitHub API |
| `owner.avatar_url` | GitHub API |
| `repo.stars` | GitHub API |
| `repo.default_branch` | GitHub API |
| `latest_commit` | GitHub API |
| `agentguard_scan_id` | AgentGuard API |
| `agentguard_report_url` | AgentGuard API |
| `evaluated_at` | Timestamp at time of enrichment |

The enriched file is committed back automatically after merge.

---

## Guidelines

- **Public repos only** — private repos cannot be validated
- **No duplicates** — check the `skills/` folder before submitting
- **One PR per skill** — keeps review focused

