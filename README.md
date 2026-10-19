# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Vercel deployment

Set the Vercel project root directory to the repository root (`.`), the
directory containing `package.json` and `vercel.json`. There is no separate
`frontend` directory. The included `vercel.json` identifies the Astro
framework, and the Astro config selects Vercel's adapter during Vercel builds
so page routes and `/api/*` endpoints are deployed as server-rendered
functions. Astro handles page routing and 404s; do not add a catch-all rewrite
that would send API requests to a page. Local development and standalone Node
builds continue to use the Node adapter.

Add `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
`CLOUDINARY_API_SECRET` as Vercel project environment variables for each
environment you deploy. Keep secrets in Vercel's environment-variable settings,
not in `vercel.json` or source control.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Admin account security

Admin credentials are stored in MongoDB and managed from an interactive terminal. No admin username, password, recovery key, or session-signing secret is needed in environment variables. `MONGODB_URI` is still required by the app.

Create the first admin account from the repository root:

```sh
npm run admin:create
```

To change or recover the password, run this on a trusted machine with database access:

```sh
npm run admin:password
```

Both commands prompt for passwords without displaying them. Passwords must be 12 to 128 characters and are stored as bcrypt hashes. Changing the password invalidates all existing sessions. Admin sessions are random, database-backed tokens; only their SHA-256 hashes are stored. Restrict database access and use HTTPS in production.
