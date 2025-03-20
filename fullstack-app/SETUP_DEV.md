# DEVELOPMENT ENVIRONMENT SETUP

Glossary:

- The main app: Refers to the Next.js main app, under `fullstack-app` folder in this repository.
- Trigger.dev: Is the [Trigger.dev](https://trigger.dev/) self-hosted instance, you'll clone a repository to run it locally on your system.

## Services

To run the main app, you must have accounts and API keys for these third party services:

- [OpenAI API](https://platform.openai.com) – Used for LLM calls.
- [LlamaCloud API](https://cloud.llamaindex.ai/) – Used to parse PDF documents with LlamaParse.
- [Clerk API](https://dashboard.clerk.com/) – Provides authentication.

**Steps:**

- Sign up for an account with OpenAI, LlamaCloud, and Clerk.
- Create API keys for each service following their onboarding process.
- Add these keys to the main app's .env file as follows:

    ```txt
    OPENAI_API_KEY=your_openai_project_api_key
    LLAMA_CLOUD_API_KEY=your_llamacloud_api_key
    CLERK_SECRET_KEY=your_clerk_secret_api_key
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_public_api_key
    ```

- If you encounter any errors with OpenAI calls, you may need to check if you have set up a payment method. They offer free credits (for now) but only if you have a payment method configured.

No additional configuration should be required for these services beyond setting the keys in the .env file.

## Trigger.dev

1. Follow the instructions of section 'Option 1: Single server' on [Trigger.dev self-hosting docs](https://trigger.dev/docs/open-source-self-hosting) until after you execute `./start.sh` command inside the Trigger.dev repository. That will start the Docker containers that will run the Trigger.dev instance.

    **NOTE**: Execute the command on a dedicated terminal to see the logs because you'll need them.

1. You should have the Trigger.dev repository downloaded and the docker container running for now. Check that you can access the trigger.dev dashboard at [http://localhost:3040](http://localhost:3040/) (or whatever port you set up in the container).

1. Stop the container by pressing `Ctrl+C` in the terminal where it's running.

1. Configure an admin email in the Trigger.dev repository. Open file `.env` and look for `ADMIN_EMAILS` env var. Uncomment it by deleting the `#` at the beginning of the line and replace the current value with your email. More on the [auth part of the docs](https://trigger.dev/docs/open-source-self-hosting#auth-options).

1. Do the same for the env var `WHITELISTED_EMAILS`, to restrict which emails can sign up to your Trigger.dev instance. It's optional, but it's a good idea to restrict it to your own email just in case you end up exposing your instance to the public internet.

1. Save the file, run the container again and open the dasbhoard at [http://localhost:3040](http://localhost:3040/) and enter the admin email. A magic link will be generated **but not sent to you** since you've not configured the email service. But it's not needed, because the magic link will be visible in the logs of the container, below this log entry: `webapp-1 | Click here to log in with this magic link`.

1. Open the magic link, follow the instructions and then you should be logged in as an admin.

1. Now configure the Trigger.dev's project. Name it whatever you want and select v3 as the project's version.

1. In the Trigger.dev dashboard, a series of steps with commands will be presented to you. Grab the project ID from the first command (it'll be the parameter `-p` that starts with `proj_`) and add it to **the main app's** `.env` file as `TRIGGER_DEV_PROJECT_ID`.

1. Open a terminal in the main app's root directory.

1. Copy and paste the commands that appears on the dashboard to setup the main app, it'll ask you to open a second magic link. Then, you can continue with the [Trigger.dev docs](https://trigger.dev/docs/quick-start) from step 5 to perform a test task run.

1. When you've seen you first test task run successfully completed you have set up Trigger.dev container correctly, now let's finish the setup of the main app.

1. Go to Trigger.dev dashboard. Click on API Keys and copy the one for your environment. Add it to **the main app's** `.env` file as `TRIGGER_SECRET_KEY`.

1. Grab the base URL of the Trigger.dev dashboard (usually `http://localhost:3040`) and add it to **the main app's** `.env` file as `TRIGGER_API_URL`.

## Executing the Development Environment Setup Script

After you have completed the Trigger.dev setup as described above, you can finalize your local development environment by running the automated setup script. This script will:

- Install npm dependencies automatically.
- Update your PostgreSQL database schema using Prisma (via `npm run db:push`).
- Seed your database with the default GlobalSettings values (via `npm run db:seed`).
- Start the necessary Docker containers for PostgreSQL, ClamAV, and ChromaDB.
- Verify that the Trigger.dev container is running.

**To execute the script:**

1. Open a Linux terminal at the root of the main app.
2. Make sure the Trigger.dev container is running (refer to the Trigger.dev setup instructions above).
3. Run the command `./start-dev-env.sh`.
4. Follow any on-screen prompts. For example, you may be asked to confirm if you wish to push the updated database schema. Answer accordingly.

Once the script completes, your development environment is ready.

You can then start the application with command `npm run dev`. It will start Next.js and Trigger.dev. You always need both to develop the main app.

You should be able to access the main app at [localhost:3000](http://localhost:3000). It'll ask you to create an account with Clerk, and then you'll be able to use it.

All set up! Let's develop! 🚀
