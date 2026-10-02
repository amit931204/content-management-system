# 🛡️ Security Vulnerability Assessment & Audit Report

**Project:** Content Management System (CMS)  
**Stack:** Angular 20, Firebase Authentication, Cloud Firestore  
**Audit Date:** October 2, 2026  
**Auditor Role:** Head of Security / Lead Application Security Architect  
**Status:** Under Review (Pending Remediation)

---

## Executive Summary

A comprehensive defensive source code and security architecture review was conducted on the repository. The review identified **9 security vulnerabilities and architectural loopholes** across Cloud Firestore Security Rules, Authentication flows, Profile data management, and Client-Side authorization guards.

Immediate attention is required for **SEC-01** (unauthenticated PII disclosure of emails and UIDs) and **SEC-02** (client-side RBAC without tamper-proof Firebase custom claims).

---

## 📊 Vulnerability Matrix

| ID | Vulnerability Title | Severity | Affected Component | Status |
|:---|:---|:---:|:---|:---:|
| **SEC-01** | Unauthenticated PII Disclosure (Email & UID Harvest) | 🔴 **Critical** | Firestore Rules & Auth Service | ✅ **Hardened** |
| **SEC-02** | Insecure Client-Side RBAC & Missing Custom Claims | 🔴 **High** | Firestore Rules & Route Guards | ✅ **Fixed** |
| **SEC-03** | Author Identity Spoofing in Posts & Comments | 🔴 **High** | Firestore Rules & Content Service | ✅ **Fixed** |
| **SEC-04** | Race Condition & Permanent Lockout on Email Update | 🔴 **High** | Content Service (`updateProfile`) | ✅ **Fixed** |
| **SEC-05** | Write Contention & DoS on Unbounded Likes/Comments | 🟡 **Medium-High** | Content Service & Firestore Rules | ✅ **Mitigated** |
| **SEC-06** | Missing Firebase App Check (API Abuse & Bot Risk) | 🟡 **Medium** | Firebase Configuration | ⏳ Setup Pending |
| **SEC-07** | Query Filter Mismatch in User Listing Rules | 🟡 **Medium** | Firestore Rules (`/users`) | ✅ **Fixed** |
| **SEC-08** | Hardcoded Firebase Identifiers & Unrestricted API Key | 🟡 **Medium** | Environment Config / GCP Console | ⏳ Console Setup |
| **SEC-09** | Missing Web Security Headers & Clickjacking Exposure | 🟢 **Low** | Firebase Hosting Config (`firebase.json`) | ✅ **Fixed** |

---

## Detailed Findings & Actionable Remediations

---

### [SEC-01] Unauthenticated PII Disclosure & User Enumeration

- **Severity:** 🔴 **Critical (CVSS 8.6)**
- **Affected Files:**
  - [`firestore.rules` (Lines 97-105)](file:///c:/Users/amitb/content-management-system/firestore.rules#L97-L105)
  - [`src/app/auth.service.ts` (Lines 37-43, 63-66)](file:///c:/Users/amitb/content-management-system/src/app/auth.service.ts#L37-L43)
- **Technical Description:**
  To support login using `username`, the client queries the `/usernames/{username}` collection before invoking Firebase Auth. To allow unauthenticated users to log in, [`firestore.rules`](file:///c:/Users/amitb/content-management-system/firestore.rules) sets:
  ```firestore
  match /usernames/{username} {
    allow get: if true;
    allow list: if false;
  }
  ```
  The document contains `{ uid: string, email: string }`.
- **Threat Scenario & Impact:**
  Any anonymous internet user can query `/usernames/<username>` without credentials. An automated dictionary script can scrape email addresses and internal UIDs of every user in the system. This violates data privacy compliance (GDPR, DPDP Act) and enables targeted phishing attacks and credential stuffing.
- **Remediation Plan:**
  - **Option A (Recommended):** Shift to standard Email + Password login on the frontend, removing the need for a public unauthenticated `/usernames` lookup table.
  - **Option B (If username login is strictly required):** Implement a Firebase Cloud Function (e.g. `loginWithUsername` or `createCustomToken`) that verifies credentials server-side and issues a secure custom auth token with rate-limiting and reCAPTCHA Enterprise enforcement. Never allow client-side public reads on email mappings.
- **Review Checklist:**
  - [ ] Revoke public `allow get: if true;` from `/usernames/{username}`.
  - [ ] Implement secure authentication pipeline without raw email exposure.

---

### [SEC-02] Insecure Client-Side RBAC & Missing Firebase Custom Claims

- **Severity:** 🔴 **High (CVSS 8.1)**
- **Affected Files:**
  - [`src/app/auth.guard.ts` (Lines 17-25)](file:///c:/Users/amitb/content-management-system/src/app/auth.guard.ts#L17-L25)
  - [`firestore.rules` (Lines 16-28, 68-95)](file:///c:/Users/amitb/content-management-system/firestore.rules#L16-L28)
- **Technical Description:**
  User roles (`user`, `admin`, `super_admin`) are stored inside the mutable Firestore document `/users/{uid}`. Angular route guards (`requireRole`) execute purely inside the browser, which can be bypassed via browser DevTools or direct REST API requests. In Firestore rules:
  ```firestore
  function hasRole(roleName) {
    return signedIn()
      && exists(userPath(request.auth.uid))
      && get(userPath(request.auth.uid)).data.role == roleName;
  }
  ```
- **Threat Scenario & Impact:**
  - **Financial / Quota Denial of Service:** Every single security rule checking `isAdmin()` or `isSuperAdmin()` triggers an extra billable `get()` read on Firestore. A burst of requests can quickly deplete daily quotas or cause runaway billing ("Denial of Wallet").
  - **Desynchronization & Elevation:** Roles stored in regular collections are more prone to race conditions or accidental rule misconfigurations than cryptographically signed JWT claims.
- **Remediation Plan:**
  - Use **Firebase Auth Custom Claims** (`auth.setCustomUserClaims(uid, { role: 'admin' })`) managed strictly via backend/Cloud Functions.
  - In [`firestore.rules`](file:///c:/Users/amitb/content-management-system/firestore.rules), verify roles instantly without database reads:
    ```firestore
    function isAdmin() {
      return request.auth != null && request.auth.token.role == 'admin';
    }
    ```
- **Review Checklist:**
  - [ ] Setup Admin SDK script/function for custom claims provisioning.
  - [ ] Replace `get(userPath(...))` in security rules with `request.auth.token.role`.
  - [ ] Update [`auth.guard.ts`](file:///c:/Users/amitb/content-management-system/src/app/auth.guard.ts) to verify `getIdTokenResult().claims`.

---

### [SEC-03] Author Identity Spoofing in Posts & Comments

- **Severity:** 🔴 **High (CVSS 7.5)**
- **Affected Files:**
  - [`firestore.rules` (Lines 114-130, 163-177)](file:///c:/Users/amitb/content-management-system/firestore.rules#L114-L130)
  - [`src/app/content.service.ts` (Lines 174, 300)](file:///c:/Users/amitb/content-management-system/src/app/content.service.ts#L174)
- **Technical Description:**
  Firestore rules enforce `request.resource.data.userId == request.auth.uid`, but do **not** validate `request.resource.data.authorName`. The client application provides `authorName: currentUser.displayName ?? 'Content Desk user'`.
- **Threat Scenario & Impact:**
  A logged-in attacker can bypass the Angular frontend and send a direct Firestore write setting `authorName: "Amit (Super Admin)"` or `"Official Support"`. The document is accepted and stored, displaying fraudulent author names to all users, enabling impersonation and social engineering attacks.
- **Remediation Plan:**
  - Validate in [`firestore.rules`](file:///c:/Users/amitb/content-management-system/firestore.rules):
    ```firestore
    request.resource.data.authorName == request.auth.token.name
    ```
  - Alternatively, do not store `authorName` on the post/comment document. Store only `userId` and resolve the author profile dynamically on the client from a trusted profile cache.
- **Review Checklist:**
  - [ ] Add authorName verification in post creation rules.
  - [ ] Add authorName verification in comment creation rules.

---

### [SEC-04] Race Condition & Permanent Lockout on Email Update

- **Severity:** 🔴 **High (CVSS 7.4)**
- **Affected Files:**
  - [`src/app/content.service.ts` (Lines 106-157)](file:///c:/Users/amitb/content-management-system/src/app/content.service.ts#L106-L157)
- **Technical Description:**
  In `updateProfile`, `updateEmail(currentUser, email)` is executed in Firebase Auth before the Firestore transaction runs. If the Firestore transaction fails (due to connection drop, rule rejection, or conflict) and the rollback `updateEmail(currentUser, oldEmail)` fails:
  1. Firebase Auth holds the new email.
  2. Firestore holds the old email.
  3. The username index points to the old email.
  Furthermore, `updateEmail` updates the email without verifying ownership of the new email address.
- **Threat Scenario & Impact:**
  - **Account Lockout:** The user can never log in again via their username because the username lookup returns an email address that no longer exists in Firebase Auth.
  - **Account Hijacking:** An attacker with transient session access can alter the email immediately to an unverified email address, seizing the account without verification.
- **Remediation Plan:**
  - Replace deprecated `updateEmail` with `verifyBeforeUpdateEmail(currentUser, newEmail)`.
  - Let Firebase Auth handle the email change confirmation link. Once verified, update Firestore via a Cloud Function trigger (`functions.auth.user().onUpdate`).
- **Review Checklist:**
  - [ ] Migrate `updateEmail` to `verifyBeforeUpdateEmail`.
  - [ ] Decouple Auth credential state updates from client-side Firestore rollback.

---

### [SEC-05] Write Contention & DoS on Unbounded Likes and Comments

- **Severity:** 🟡 **Medium-High (CVSS 6.5)**
- **Affected Files:**
  - [`src/app/content.service.ts` (Lines 245-264, 292-308)](file:///c:/Users/amitb/content-management-system/src/app/content.service.ts#L245-L264)
  - [`firestore.rules` (Lines 38-66)](file:///c:/Users/amitb/content-management-system/firestore.rules#L38-L66)
- **Technical Description:**
  Every like toggle or comment insertion runs a transaction updating `likesCount` and `commentsCount` directly on the parent `/posts/{postId}` document. There is no throttling or rate limiting on comment submissions.
- **Threat Scenario & Impact:**
  - **Firestore Document Contention:** Firestore enforces a limit of approximately 1 sustained write per second per document. High engagement on a post will cause transactions to fail repeatedly with contention errors.
  - **Spam & Denial of Wallet:** An authenticated script can spam hundreds of comments or rapidly toggle likes, creating high read/write volume and inflating database costs.
- **Remediation Plan:**
  - Enforce a time-interval rate limit on comment creation in [`firestore.rules`](file:///c:/Users/amitb/content-management-system/firestore.rules) (e.g. at least 5-10 seconds between comments per user).
  - For high-volume posts, consider distributed counters or count recalculation via background functions.
- **Review Checklist:**
  - [ ] Add rate limiting check for comment frequency in security rules.
  - [ ] Add client-side debounce and disabling on like/comment buttons.

---

### [SEC-06] Missing Firebase App Check (API Abuse & Bot Risk)

- **Severity:** 🟡 **Medium (CVSS 6.3)**
- **Affected Files:**
  - [`src/app/firebase.ts`](file:///c:/Users/amitb/content-management-system/src/app/firebase.ts)
- **Technical Description:**
  Firebase App Check is not configured. Requests directly to Cloud Firestore and Firebase Auth endpoints from scripts, postman, or custom bots cannot be distinguished from legitimate requests originating from the Angular application.
- **Threat Scenario & Impact:**
  Attackers can scrape all posts, flood comments, attempt credential stuffing, or abuse Firestore bandwidth without ever loading your web application.
- **Remediation Plan:**
  - Initialize Firebase App Check with **reCAPTCHA Enterprise** (or reCAPTCHA v3) provider in [`src/app/firebase.ts`](file:///c:/Users/amitb/content-management-system/src/app/firebase.ts).
  - Enforce App Check in Firebase Console for Firestore and Auth.
- **Review Checklist:**
  - [ ] Provision reCAPTCHA Enterprise key in Google Cloud Console.
  - [ ] Initialize `initializeAppCheck` in `firebase.ts`.

---

### [SEC-07] Query Filter Mismatch in User Listing Rules

- **Severity:** 🟡 **Medium (CVSS 5.3)**
- **Affected Files:**
  - [`firestore.rules` (Lines 74-75)](file:///c:/Users/amitb/content-management-system/firestore.rules#L74-L75)
- **Technical Description:**
  In `/users/{userId}`:
  ```firestore
  allow list: if isSuperAdmin()
    || (isAdmin() && resource.data.role == 'user');
  ```
  In Cloud Firestore rules, `resource.data` is not defined for unbounded `list` operations. Unless the client query specifically includes a matching `where('role', '==', 'user')` clause, Firestore rules evaluate `resource` as null and reject the query with `permission-denied`.
- **Threat Scenario & Impact:**
  Admin user management queries will fail unexpectedly, or require precise client-side filters that, if altered, lead to authorization denial or inconsistent behavior.
- **Remediation Plan:**
  - Ensure admin listing queries use explicit `where` constraints or delegate administrative user management to secure Cloud Functions.
- **Review Checklist:**
  - [ ] Verify query rules alignment with actual Firestore queries.

---

### [SEC-08] Hardcoded Identifiers & Unrestricted Google Cloud API Key

- **Severity:** 🟡 **Medium (CVSS 5.0)**
- **Affected Files:**
  - [`src/app/firebase.ts` (Lines 6-13)](file:///c:/Users/amitb/content-management-system/src/app/firebase.ts#L6-L13)
- **Technical Description:**
  The `firebaseConfig` object is hardcoded in source control. While Firebase API keys are designed to be public to identify client applications, they must be properly restricted in the Google Cloud Console.
- **Threat Scenario & Impact:**
  If the API key is not restricted to specific HTTP referrers and specific APIs, it can be reused against other enabled Google Cloud APIs in the same GCP project.
- **Remediation Plan:**
  - Move configuration into Angular environment files (`environment.ts` / `environment.prod.ts`).
  - In **Google Cloud Console > Credentials**:
    - Restrict application to `HTTP referrers` (e.g. `your-domain.web.app/*`, `localhost:*` for development).
    - Restrict API scope strictly to *Identity Toolkit API*, *Token Service API*, and *Cloud Firestore API*.
- **Review Checklist:**
  - [ ] Apply HTTP Referrer restrictions in Google Cloud Console.
  - [ ] Restrict API keys to necessary services only.

---

### [SEC-09] Missing Web Security Headers & Clickjacking Exposure

- **Severity:** 🟢 **Low / Hygiene (CVSS 4.3)**
- **Affected Files:**
  - [`firebase.json`](file:///c:/Users/amitb/content-management-system/firebase.json)
  - [`src/index.html`](file:///c:/Users/amitb/content-management-system/src/index.html)
- **Technical Description:**
  The application does not specify HTTP security headers (`X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`).
- **Threat Scenario & Impact:**
  - **Clickjacking:** An external malicious website can embed your application in a hidden `<iframe>` and trick authenticated users into performing actions (e.g. deleting posts, updating profiles).
  - **MIME Sniffing:** Browsers may inspect content types and execute unexpected payloads.
- **Remediation Plan:**
  - Configure hosting headers in [`firebase.json`](file:///c:/Users/amitb/content-management-system/firebase.json):
    ```json
    {
      "hosting": {
        "headers": [
          {
            "source": "**",
            "headers": [
              { "key": "X-Frame-Options", "value": "DENY" },
              { "key": "X-Content-Type-Options", "value": "nosniff" },
              { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
              { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
            ]
          }
        ]
      }
    }
    ```
- **Review Checklist:**
  - [ ] Add security response headers to [`firebase.json`](file:///c:/Users/amitb/content-management-system/firebase.json).
  - [ ] Verify clickjacking protection (`X-Frame-Options: DENY`).

---

## 🎯 Phased Remediation Roadmap

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Critical Immediate Patches (Rules & Identity)     │
│ - SEC-01: Remove unauthenticated PII access on /usernames   │
│ - SEC-03: Enforce authorName validation in firestore.rules  │
│ - SEC-09: Add Security Headers & Clickjacking defense       │
├─────────────────────────────────────────────────────────────┤
│ Phase 2: Architectural Hardening (Auth & Custom Claims)     │
│ - SEC-02: Implement Firebase Custom Claims for RBAC         │
│ - SEC-04: Implement verifyBeforeUpdateEmail                │
│ - SEC-05: Rate limiting on likes & comments                │
├─────────────────────────────────────────────────────────────┤
│ Phase 3: Infrastructure & Bot Defense                       │
│ - SEC-06: Enable Firebase App Check with reCAPTCHA Ent.     │
│ - SEC-08: Restrict Google Cloud API keys in Console         │
└─────────────────────────────────────────────────────────────┘
```
