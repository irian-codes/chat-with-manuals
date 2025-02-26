# Chat with Manuals

An app I created because I tested different automatic RAGs (like OpenAI Assistants, simple chunking and Gemini 1 Million context window) and they suffered from the following problems:

- They hallucinated a lot (OpenAI and simple chunking).
- In the case of Gemini 1M context, the latency per question was around 60 seconds (this is very, very slow).
- The chatbot wasn't answering in the tone and style I wanted to, and a RAG allows the app to use any model and control the system prompts.

I did some research and found that LLM RAG apps are as good as the context you give them. So I created this app, which retrieves context specifically from documents shaped like product or board game manuals, that is, with a title and sections with subtitles that don't go longer than two or three pages. With these constraints in place, I've built a RAG that almost doesn't hallucinate and is fast enough 😁.

This is my first project with AI, and I'm glad I could finish it to a state where its actually useful for my needs. Feel free to use it however you want though!

## How's does this RAG work?

1. The document the user uploads is parsed using LlamaParse (AI Vision).
1. It is split into JSON sections from the Markdown the parsing generates.
1. These sections are further split into chunks, and then embedded into Chroma DB vector database.
1. AI parsing causes hallucinations, so on upload, the user can select the document type to help the parser do a better job. There are several custom parsing prompts for LlamaParse depending on the type.
1. After parsing, the user can create a chat conversation with his document. When the user asks a question it performs a similarity search and gets the appropriate chunks.
1. From these chunks, the surrounding parts in the same section are concatenated, creating longer chunks, so they are like a better overlapping feature.
1. Sections are ordered according to document order and their titles added to each chunk to give the LLM more context. This way, the LLM can check much more than just a chunk, but a good portion of a section!
1. The user obtains the answer and, hopefully, is now happy 😄.

## Stack

The app uses, as the main stack: TypeScript, Zod, Next.js Pages Router, TRPC, Trigger.dev, Clerk, Prisma, Chroma DB (vector database), Shadcn/ui, Tailwind CSS, Lucide Icons, next-intl, usehooks-ts and LangChain.

## Structure of this repository

The `main` branch of this repository contains the **final polished version** of the app, built from scratch after careful planning, design and research (shown in [`research`](https://github.com/irian-codes/chat-with-manuals/tree/research) branch). `main` focuses solely on the final, polished version of the app, and no code from the `research` branch can be merged here.

The `develop` branch is the default one of the repo because it's where changes are merged by default. This way I can test it well before merging it to `main`.

To setup the project for development so you can try it out, read the [SETUP_DEV.md](https://github.com/irian-codes/chat-with-manuals/blob/develop/fullstack-app/SETUP_DEV.md) file.

## Motivation

My development journey began with a focus on frontend technologies, but I often found myself limited by the lack of my backend development capabilities. My goal is to be able to transform ideas into full apps, end to end, so I studied Full Stack development. Also, AI fascinates me since Chat GPT launched, and I wanted to learn how to build cool stuff with it.

I decided to use Next.js Pages Router with Node.js because they're the most widely used technologies for full stack development, so they are robust, proven and very capable. It's true that I could have gone with the App Router, but since this was my first full stack project I wanted to get the basics well first. The rest of technologies I used follow a similar criterion, unless there was a clear benefit of using a newer one (like Clerk for auth, as it saves so much time).

So, this serves as my capstone project, illustrating my ability to design and build complete AI applications from the ground up. I've learnt a ton and I still want to learn much more.

I am now equipped to turn ideas into cool and useful apps! 💪 I hope you like it 😊.
