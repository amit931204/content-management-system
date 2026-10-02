# Content Management System

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.30.

## Firebase setup

Firebase is initialized in `src/app/firebase.ts`. The module exports the app, Firebase Authentication, Cloud Firestore, and browser-supported Analytics instances. The Firebase web config is public client configuration; protect data with Firebase Authentication and Firestore Security Rules rather than treating the API key as a secret.

Before using registration and login, enable **Authentication > Sign-in method > Email/Password** in the Firebase Console and create a **Cloud Firestore** database for the `user-management-amit` project. Set Firestore Security Rules before storing user data; do not deploy open test rules.

The app opens at `/login`; `/signup` creates an account and sends the signed-in user to `/home`. Firebase Authentication enforces email uniqueness. User profiles are stored in `users/{uid}`; a case-insensitive `usernames/{username}` document reserves each username and maps it to its sign-in email. The current client login flow looks up a username before authentication, so a Firestore rule that allows unauthenticated reads can expose those email fields. Do not enable broad public reads in production; move username resolution to a trusted, rate-limited backend before handling real user data.

## User roles

Every profile has a `role`: `user`, `admin`, or `super_admin`. Public signup always assigns `user`; there are no fixed role-count limits. A user's role selects the protected `/home`, `/admin`, or `/super-admin` destination.

To provision an administrator manually, create the account under **Authentication > Users**, then create `users/{uid}` in Firestore using that Auth UID as the document ID. Store the profile fields plus `role: "admin"` or `role: "super_admin"`. Also create `usernames/{lowercaseUsername}` with that account's `uid` and `email`, because the login form looks up email by username. Do this only from a trusted Firebase Console account. `firestore.rules` prevents ordinary users from assigning or changing roles and lets super-admins manage profiles. Deploy the rules with `firebase deploy --only firestore:rules`.

The username lookup currently permits direct reads of a known username document and includes its email. Keep username values non-sensitive; before production, replace this lookup with a trusted backend endpoint to avoid exposing email mappings.

## Normal user pages

Signed-in users can edit their username, email, name, date of birth, contact number, and address on `/profile`. The UID remains view-only. Username reservation and profile changes are synced in a Firestore transaction; email changes update Firebase Authentication and the username mapping, and may require a recent sign-in.


`/home` shows the 10 newest posts, `/posts` lists posts newest-first and searches titles/details in the loaded collection, `/my-posts` lists the current user's posts, `/posts/new` creates a plain-text post, and `/posts/{postId}` shows its details, likes, comments, and shareable URL. Posts store the title and plain-text `details` in `posts/{postId}`. Likes and comments live in post subcollections. New posts set `approvalId` to `null` and are visible immediately; approval is not implemented yet. The all-post search loads the collection into the browser, which should be replaced with indexed search if the dataset becomes large.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
