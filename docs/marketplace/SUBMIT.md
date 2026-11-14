# Submitting "Tether for Marketplace" (step by step)

App: **Tether for Marketplace**, id `9cca0b82-9b9f-42f8-9049-5db82c3a263e`, owner Đăng.
Production is deployed with the current `main` code (3.0.0, 14 Nov 2026, Runs on Atlassian
eligible). Distribution status: Not sharing; not listed yet.

Never share this app by installation link: once it is submitted to Marketplace it can't be.
Judges use the other app (**Tether**, `07520459-...`).

Who does what: **[You]** = Đăng only (accounts, agreements, Submit). **[Claude]** = can be
done for you in a session (deploys, text, checks). **[Bảo]** = issue #3 (assets).

## 1. Partner profile [You]
1. Go to https://marketplace.atlassian.com/manage and sign in with the same Atlassian
   account that owns the app (the one used for `forge deploy`).
2. Choose **Create a new partner** / **Become a Marketplace partner**.
3. Partner name: `Tether team` (or your own name if you prefer). Contact email: the one you
   want public for support. Country: Singapore. Read and accept the **Marketplace Partner
   Agreement**.
4. Link the partner to the developer space that holds the app if asked (developer console
   → the "Tether" developer space).

## 2. Assets [Bảo, issue #3]
Logo 144×144 + 1024×1024, banner 1120×548, 3–5 screenshots 1840×900 in
`docs/marketplace/assets/`. You can submit once the logo and 3 screenshots exist.

## 3. Public URLs [nothing to do]
The repo is public, so these work as-is:
- Privacy policy: https://github.com/dngvmnh/Tether/blob/main/docs/marketplace/PRIVACY.md
- Terms / EULA: https://github.com/dngvmnh/Tether/blob/main/docs/marketplace/TERMS.md
  (or pick the Atlassian standard EULA in the form)
- Documentation: https://github.com/dngvmnh/Tether#readme
- Support: https://github.com/dngvmnh/Tether/issues

## 4. Create the listing [You, with Claude filling text]
1. In the partner portal: **Publish a new app** (or Apps → Create app) → **Forge app** →
   choose **Tether for Marketplace** from the list of your Forge apps.
2. Hosting: Cloud. Products: **Jira** (and Confluence if the form allows a second product;
   the app uses both). Price: **Free**. Payment model: free.
3. Fill the fields from `docs/marketplace/LISTING.md`: name, tagline, summary, 3 highlights
   with a screenshot each, description, category, links from step 3.
4. **Privacy & security** tab: answers are in LISTING.md ("Data security questionnaire").
   Key points: no egress, Runs on Atlassian, stores Atlassian account IDs only, data deleted
   on uninstall.
5. Version: it picks up the latest production deployment. If it asks for compatibility,
   choose Jira Cloud + Confluence Cloud.

Claude can take over steps 4.2–4.5 in the browser pane once you are signed in: the form is
just text and file uploads. You review and click Submit.

## 5. Submit [You]
1. Click **Submit for approval**. That is the point of no return for install-link sharing
   of this app (fine: judges use the other app).
2. Copy the **listing URL** or the **review ticket** link (in the email from Atlassian
   Marketplace) into `docs/DEVPOST.md` → Bonus-prize evidence → Marketplace row.
3. Target: **Sun 6 Dec** (review can take days; "submitted for listing" with the ticket
   link counts for the bonus).

## 6. After submission
- Each later code change: `node scripts/use-app.mjs marketplace`, `forge deploy -e production`,
  `node scripts/use-app.mjs judging`. Never commit `manifest.yml` with the Marketplace id.
- If the reviewer asks questions, answer from `docs/ARCHITECTURE.md` (security notes) and
  `docs/marketplace/PRIVACY.md`.
