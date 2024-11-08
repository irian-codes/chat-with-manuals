# Chat with Manuals

An app I created because I tested different automatic RAGs (like OpenAI Assistants, simple chunking and Gemini 1 Million context window) and they suffered from these problems:
- They hallucinated a lot (OpenAI and simple chunking)
- In the case of Gemini 1M context, the latency per question was around 60 seconds (this is very, very slow)
- The chatbot wasn't answering in the tone and style I wanted to, and a RAG allows the app to use any model.

I did some research and found that LLM RAG apps are as good as the context you give them. So I created this app, which retrieves context specifically from documents shaped like product manuals, that is, with a title and sections with subtitles that don't go longer than two or three pages. With these constraints in place, I've built a RAG that almost doesn't hallucinate and is fast 🚀.

## How's this accomplished?
1. The document the user uploads is parsed using LlamaParse (AI Vision) and pdf-reader (traditional layout parsing).
1. It is split by sentence using a custom text splitter.
1. AI parsing causes hallucinations, so each sentence is reconciled with the layout parsing result to fix these as much as possible.
1. When the user asks a question it performs a similarity search and gets the appropriate chunks.
1. From these chunks, the surrounding parts in the same section are concatenated, creating longer chunks, so they are like a better overlapping feature.
1. Sections are ordered according to document order and their titles added to each chunk to give the LLM more context.
1. The user obtains the answer and smiles 😁.

## Purpose of This Repository
The `main` branch of this repository contains the **final polished version** of the app, built from scratch after careful planning, design and research (shown in [`research`](https://github.com/irian-codes/chat-with-manuals/tree/research) branch). `main` focuses solely on the final, polished version of the app, and no code from the `research` branch can be merged here.

## Motivation
My development journey began with a focus on frontend technologies, but I often found myself limited by the lack of my backend development capabilities. My goal is to be able to transform ideas into full apps, end to end, so I studied Full Stack development.

This serves as my capstone project, illustrating my ability to design and build complete applications from the ground up.

With this, I am now equipped to turn ideas into great apps! 💪 I hope you like it 😊.
