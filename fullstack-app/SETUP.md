# SETUP

Glossary:

- The main app: Refers to the Next.js main app, under `fullstack-app` folder in this repository.
- Trigger.dev: Is the Trigger.dev self-hosted instance or the repository you'll clone to run it locally on your system.

## Trigger.dev (for development)

1. Follow the instructions on [Trigger.dev self-hosting docs](https://trigger.dev/docs/open-source-self-hosting) until after you execute `./start.sh` command inside the Trigger.dev repository. That will start the Docker containers that will run the Trigger.dev instance.

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

1. From now on, you can run the main app with `npm run dev` and the Trigger.dev client with `npm run trigger:dev`. You need both running to run the app in development mode.
