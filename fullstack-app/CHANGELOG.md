# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.1.17](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.15...v0.1.17) (2025-02-22)


### Features

* **files:** on production user files are stored in a more secure server folder ([51d2c8f](https://github.com/irian-codes/chat-with-manuals/commit/51d2c8f24e9084a4a9bae103fd4751e5b61800bb))


### Bug Fixes

* **files:** allow two users to own the same file (by file hash) ([e87b665](https://github.com/irian-codes/chat-with-manuals/commit/e87b6651238d030ef5d36b292fa6d51a5e4f8535))
* **sidebar:** properly rendering titles in italic that is compatible with i18n urls ([904576c](https://github.com/irian-codes/chat-with-manuals/commit/904576c46874807a1ec6f16a3a9900ec5cd93eda))

## 0.1.16 (2025-02-22)


### Features

* **chat:** display messages as proper visaully appealing markdown ([41d6a63](https://github.com/irian-codes/chat-with-manuals/commit/41d6a63cdf6e5ef497e5a09c9d66229862f5b62d))
* **errors:** added app Error Boundary to catch rendering errors ([d8fce76](https://github.com/irian-codes/chat-with-manuals/commit/d8fce76d9def7c689c4ba9923ba20e015182728e))
* **errors:** showing errors to the user in a localized Toast ([8588797](https://github.com/irian-codes/chat-with-manuals/commit/85887973f95b29b82e03444d9e1c6f001c4be211))
* **trpc:** normalizing and saving search titles so the user can do a better fuzzy search ([5981940](https://github.com/irian-codes/chat-with-manuals/commit/5981940f6cc7597743e5fb243ba33604d57a3541)), closes [#57](https://github.com/irian-codes/chat-with-manuals/issues/57)


### Bug Fixes

* **frontend:** properly handling loading states to disable components ([06a0723](https://github.com/irian-codes/chat-with-manuals/commit/06a0723ac5add99a3dd1875bca0da6b4fc8b90a7))
* **modal:** locale form value starts unselected to force user to select ([5bcf6eb](https://github.com/irian-codes/chat-with-manuals/commit/5bcf6eb9814a8a513e5d57fdd06722ee50c97372))
* **parsing:** cancelling Trigger.dev parsing task if the file upload is cancelled from the frontend ([e9a93d6](https://github.com/irian-codes/chat-with-manuals/commit/e9a93d675847421502ee78af593558cd0e596ed4))
* **parsing:** emitting error event when parsing fails ([be3f6fc](https://github.com/irian-codes/chat-with-manuals/commit/be3f6fce11ac75634b0df92c939e71934bb42bb8))
* **sidebar:** new conversation button was obscured when list got too long ([3431863](https://github.com/irian-codes/chat-with-manuals/commit/343186309d64d1035366df2582e962a3f3c38663))
* **trigger-dev:** fixed wrong idempotency keys for Trigger.dev tasks ([a73be1e](https://github.com/irian-codes/chat-with-manuals/commit/a73be1e0febe163d028abf6fdc7c801a50a2f88b))

## [0.1.15](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.14...v0.1.15) (2025-02-17)


### Features

* **chat:** display messages as proper visually appealing markdown ([41d6a63](https://github.com/irian-codes/chat-with-manuals/commit/41d6a63cdf6e5ef497e5a09c9d66229862f5b62d))
* **trpc:** normalizing and saving search titles so the user can do a better fuzzy search ([5981940](https://github.com/irian-codes/chat-with-manuals/commit/5981940f6cc7597743e5fb243ba33604d57a3541)), closes [#57](https://github.com/irian-codes/chat-with-manuals/issues/57)


### Bug Fixes

* **frontend:** properly handling loading states to disable components ([06a0723](https://github.com/irian-codes/chat-with-manuals/commit/06a0723ac5add99a3dd1875bca0da6b4fc8b90a7))
* **modal:** locale form value starts unselected to force user to select ([5bcf6eb](https://github.com/irian-codes/chat-with-manuals/commit/5bcf6eb9814a8a513e5d57fdd06722ee50c97372))
* **parsing:** cancelling Trigger.dev parsing task if the file upload is cancelled from the frontend ([e9a93d6](https://github.com/irian-codes/chat-with-manuals/commit/e9a93d675847421502ee78af593558cd0e596ed4))
* **parsing:** emitting error event when parsing fails ([be3f6fc](https://github.com/irian-codes/chat-with-manuals/commit/be3f6fce11ac75634b0df92c939e71934bb42bb8))
* **sidebar:** new conversation button was obscured when list got too long ([3431863](https://github.com/irian-codes/chat-with-manuals/commit/343186309d64d1035366df2582e962a3f3c38663))
* **trigger-dev:** fixed wrong idempotency keys for Trigger.dev tasks ([a73be1e](https://github.com/irian-codes/chat-with-manuals/commit/a73be1e0febe163d028abf6fdc7c801a50a2f88b))

## [0.1.14](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.13...v0.1.14) (2025-02-03)


### Features

* **parsing:** parsing documents into defined sections ([17400e6](https://github.com/irian-codes/chat-with-manuals/commit/17400e62d6533e3e293c34050d92d02f26829082))
* **prompt:** sending sections in a structured way to llm ([e312c4e](https://github.com/irian-codes/chat-with-manuals/commit/e312c4e2f4855fbdde89779adfc895e8f395e5a2))


### Bug Fixes

* **file-storage:** more lenient filepath validation regex ([8489798](https://github.com/irian-codes/chat-with-manuals/commit/8489798afb183cc33f68e5f25bb1cd508ba7a8c1))

## [0.1.13](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.12...v0.1.13) (2025-01-30)


### Features

* **api-routes:** implemented timeouts to prevent stale long running requests ([45c0380](https://github.com/irian-codes/chat-with-manuals/commit/45c03803b0eb35f9b7f754c4af5fefec06506a28))
* **parsing:** implemented document parsing using Trigger.dev ([2cc4ffc](https://github.com/irian-codes/chat-with-manuals/commit/2cc4ffce6e4284c5dc67a228bea63b31d5b059b1))

## [0.1.12](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.11...v0.1.12) (2025-01-26)


### Features

* **document-image:** implemented support for uploading document images ([74f8a2c](https://github.com/irian-codes/chat-with-manuals/commit/74f8a2c99057eb3bc7757fc1a759925ba1b4d0af))
* **sidebar:** added header into the sidebar ([5f75fe7](https://github.com/irian-codes/chat-with-manuals/commit/5f75fe7727456c8d963db0fcb6d397f02d299821))


### Bug Fixes

* **conversation-sidebar:** click area of the conversation button fills the whole button ([d9f02ad](https://github.com/irian-codes/chat-with-manuals/commit/d9f02ad509ef2491882c0267e9852b85d4259de6))
* **upload-document-modal:** fixed filesize calculation ([d24e165](https://github.com/irian-codes/chat-with-manuals/commit/d24e1652b14352422beaaa052e9465e38e5578a8))

## [0.1.11](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.10...v0.1.11) (2025-01-21)


### Features

* **conversation-trpc:** sending the document description to LLM when messaging ([a9f0047](https://github.com/irian-codes/chat-with-manuals/commit/a9f004765e8a25c9f28b9602f881764724d35ff7))
* **conversation-trpc:** sending the whole conversation to LLM ([f1cfd51](https://github.com/irian-codes/chat-with-manuals/commit/f1cfd5142498b70a1f3fbc84f0eefcfe433f6067))
* **conversation:** allow editing message ([3824718](https://github.com/irian-codes/chat-with-manuals/commit/3824718a99d1c58aff01ed936e228a4ce3e005c2))
* **conversation:** infinite chat scroll ([fd192d9](https://github.com/irian-codes/chat-with-manuals/commit/fd192d9eb129f4768bf1c6762792c9399e87cedb))


### Bug Fixes

* **frontend-trpc:** prefetching with the right keys ([83a6477](https://github.com/irian-codes/chat-with-manuals/commit/83a6477edd43f88dc8e8e19b12a1101b44ac3d69))
* **sidebar:** indicating current conversation on sidebar ([2f61190](https://github.com/irian-codes/chat-with-manuals/commit/2f611904f4bd5db604d4219675b77febdfbec952))
* **sidebar:** sidebar collapse behaviour between routes corrected ([e3322ca](https://github.com/irian-codes/chat-with-manuals/commit/e3322ca2d5186134d09f66f00d8b379b71584d11))

## [0.1.10](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.8...v0.1.10) (2025-01-16)


### Features

* **document-upload:** implemented rate limiter in API Route for document upload ([319af8b](https://github.com/irian-codes/chat-with-manuals/commit/319af8b91082ab9e0a54b542abc68e8f04a1e763))
* **document-upload:** scanning for viruses in uploaded documents ([d3abdec](https://github.com/irian-codes/chat-with-manuals/commit/d3abdec2fd017bae53107c6d53eeb45d8feea2ff))


### Bug Fixes

* **conversations:** deleting conversations that have no documents ([b9fce75](https://github.com/irian-codes/chat-with-manuals/commit/b9fce75b70a6c77f963fd4105f56b3a5f8e14b92))
* **documents:** gracefully handle document parsing errors ([60e1fa6](https://github.com/irian-codes/chat-with-manuals/commit/60e1fa63d651aa30e2622b8a9012eb4f11341b0a))
* **trpc:** minor fix and better logs ([83c19e2](https://github.com/irian-codes/chat-with-manuals/commit/83c19e2d96f26d98b99176002af7e855f4c8fc54))

## [0.1.9](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.8...v0.1.9) (2025-01-13)


### Features

* **conversation:** generate title automatically with llm ([566e993](https://github.com/irian-codes/chat-with-manuals/commit/566e99322cd797b5afc5c186de0ccaf5fdfde237))
* **conversation:** prompting the LLM and retrieving chunks for context ([bcb4010](https://github.com/irian-codes/chat-with-manuals/commit/bcb401008e22b42fab0bff5ae9c707428b853b62))
* **conversations:** deleting conversation from sidebar ([af4c12a](https://github.com/irian-codes/chat-with-manuals/commit/af4c12aebdfc24515c2482a4010655587ac472f1))
* **conversations:** edit conversation title ([b90852d](https://github.com/irian-codes/chat-with-manuals/commit/b90852deb683e06adff4f2a80070ad9f26924ddb))
* **conversation:** showing a disclaimer about LLM hallucinations ([34afe8f](https://github.com/irian-codes/chat-with-manuals/commit/34afe8f878440f5cfd218e171cc2ba5578d32c52))
* **parsing:** chunking, linting and storing into vector db ([21f2d0a](https://github.com/irian-codes/chat-with-manuals/commit/21f2d0afb1d63caacb79b19b34b4937fcb9c60c6))


### Bug Fixes

* **conversation:** minor conversation fixes ([19295f7](https://github.com/irian-codes/chat-with-manuals/commit/19295f7da33317ed9b26e71131f3939b4674b961))
* **conversations:** api level search on new conversation modal fixed ([9393c5e](https://github.com/irian-codes/chat-with-manuals/commit/9393c5e108a3d560a10ec27ea728b37b02fb3233))
* **header:** fixed space and misplacement issues ([6f25ba6](https://github.com/irian-codes/chat-with-manuals/commit/6f25ba6b104f2a1b456f80ef4f41020de9ae7d82))

## [0.1.8](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.7...v0.1.8) (2025-01-09)


### Features

* **app-state:** handling async state the React Query way and prefetching ([4523884](https://github.com/irian-codes/chat-with-manuals/commit/4523884a83ec1b2d7b0c7fc4ba864aa4e92a3e4e))
* **search:** api level search ([2a5e1d1](https://github.com/irian-codes/chat-with-manuals/commit/2a5e1d13ccbecb68ff57ea35044f33407ef8ace5))


### Bug Fixes

* **conversation:** better error redirection on conversation not found ([acf87b5](https://github.com/irian-codes/chat-with-manuals/commit/acf87b5e9ea4defff564347199c3640b9ceadd12))
* **conversation:** removed invalid links ([657c9ab](https://github.com/irian-codes/chat-with-manuals/commit/657c9ab0cdb205efc97794da9854937006d37b81))

## [0.1.7](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.6...v0.1.7) (2024-12-21)


### Features

* **dashboard:** implementing TRPC subscriptions for documents list ([0a35a7c](https://github.com/irian-codes/chat-with-manuals/commit/0a35a7c029b0288ca7b83ed32f3907c2b50e4e2a))
* **db:** added chroma db with langchain ([585081d](https://github.com/irian-codes/chat-with-manuals/commit/585081d7a46a05954ec069ad3602694afbf28a71))
* **parsing:** parsing documents with Llamaparse ([bd55a14](https://github.com/irian-codes/chat-with-manuals/commit/bd55a1485ab8023eeec7eea1b1bfa595f57d507b))

## [0.1.6](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.5...v0.1.6) (2024-12-19)


### Features

* **conversation:** get and display conversations from TRPC and DB ([79b20bd](https://github.com/irian-codes/chat-with-manuals/commit/79b20bd6759f48a40d1a9e7d7f4271081e4517a7))
* **conversations:** add conversation to DB via TRPC ([2cbc4dd](https://github.com/irian-codes/chat-with-manuals/commit/2cbc4ddb25321b441bdc4a65b971198c40494537))
* **conversation:** send messages to the DB via TRPC ([4ee1b3f](https://github.com/irian-codes/chat-with-manuals/commit/4ee1b3fb096770656531163f95da1513aeb748a9))
* **trpc:** added user DB in conversation router ([0f8a8ea](https://github.com/irian-codes/chat-with-manuals/commit/0f8a8ea586a84adc445e4e00137f440574796d22))
* **utils:** add string utils, pinned engines version ([0b0b5c2](https://github.com/irian-codes/chat-with-manuals/commit/0b0b5c24d313189c0bf4d5cb2fa8274fc838af26))

## [0.1.5](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.4...v0.1.5) (2024-12-16)


### Features

* **auth:** add Clerk UserButton to all pages properly ([5a6d996](https://github.com/irian-codes/chat-with-manuals/commit/5a6d996efb6f9d898622b67ab42f3c242ff57d87))
* **dashboard:** displaying only non error documents and with a loading animation ([25f9c7e](https://github.com/irian-codes/chat-with-manuals/commit/25f9c7e6ad77361dfa2d26b90260743ac33c47bf))
* **dashboard:** updating document with TRPC call ([7f783e2](https://github.com/irian-codes/chat-with-manuals/commit/7f783e2ca524c87d92a95bd08161a59dca612cb2))
* **db:** added Prisma schema first draft ([48c746a](https://github.com/irian-codes/chat-with-manuals/commit/48c746a0893cea7122a90b2acdc342a30d5e7f61))
* **db:** set stricter Prisma relation rules ([83c7ea9](https://github.com/irian-codes/chat-with-manuals/commit/83c7ea981b01d027c0e48abe9dc534c80bc302a3))
* **db:** set stricter Prisma relation rules and updated document schema ([554ca5c](https://github.com/irian-codes/chat-with-manuals/commit/554ca5cdfb1a893345141f40bc02b4f2f694cce6))
* **documents:** coded TRPC delete document procedure ([003733a](https://github.com/irian-codes/chat-with-manuals/commit/003733a3a74524c6badabd8e7622b58ee95b7f7f))
* **documents:** fetching documents on the frontend ([f43b65a](https://github.com/irian-codes/chat-with-manuals/commit/f43b65abf919fccdc238ad9318da62abcaf1dea0))
* **documents:** fixed document schema ([0af1fea](https://github.com/irian-codes/chat-with-manuals/commit/0af1feae8ee923d8ee0ada9ecf38939a9a41f4db))
* **documents:** improved document file storage on server ([e97a144](https://github.com/irian-codes/chat-with-manuals/commit/e97a144435cbed027e96672f538838f71e129c0d))
* **documents:** properly cancelling an uploading document ([f78c800](https://github.com/irian-codes/chat-with-manuals/commit/f78c800b281f724237a66e73bc7d929813f52041))
* **documents:** properly deleting document file ([e65e917](https://github.com/irian-codes/chat-with-manuals/commit/e65e91780a5b8213222e5e1fa3fabf831c647c18))
* **documents:** uploading document with formidable ([798fc3a](https://github.com/irian-codes/chat-with-manuals/commit/798fc3a9f485d15f3bb572268b08390c569523fb))
* **files:** uploading files to TRPC and saving them into a folder and db ([b82aac2](https://github.com/irian-codes/chat-with-manuals/commit/b82aac2828aa48b77a5f8b72482dc8b048a4b077))
* **trpc:** added authedProcedure with Clerk ([0abcc20](https://github.com/irian-codes/chat-with-manuals/commit/0abcc2019a8171a29857553fed28c573b22b637f)), closes [#10](https://github.com/irian-codes/chat-with-manuals/issues/10)
* **trpc:** added user routers ([5aa2bef](https://github.com/irian-codes/chat-with-manuals/commit/5aa2befc3ce48c9faa6dfe39aeccd50fa9572501))
* **trpc:** created procedure with db user present ([73d07d2](https://github.com/irian-codes/chat-with-manuals/commit/73d07d27960425a88ae99a1008e5d70d17b56936))


### Bug Fixes

* **auth:** marking userId as present since these are protected routes ([447832f](https://github.com/irian-codes/chat-with-manuals/commit/447832fb319a9477c890727f6574728c0a68e84a))
* **documents:** checking for authorization first, it's more secure ([ecdec2d](https://github.com/irian-codes/chat-with-manuals/commit/ecdec2d3c04cd832c64a87f617ceb5bf362f3e5f))
* **documents:** correctly updating the state of a pending document in a DB transaction ([d88c8b5](https://github.com/irian-codes/chat-with-manuals/commit/d88c8b5357c80544ca314854176f2976960b03e6))
* **documents:** properly checking documents ID with zod ([a973250](https://github.com/irian-codes/chat-with-manuals/commit/a973250ec5f9f00f84b4fc9e608545871378601f))
* **documents:** properly handling a non critical file deletion error ([4ae454a](https://github.com/irian-codes/chat-with-manuals/commit/4ae454a5f13962a4d0a64872c89883b7b809ccf3))
* **documents:** properly handling file already exists error ([71d0be2](https://github.com/irian-codes/chat-with-manuals/commit/71d0be26eb87a3b87e2b5825a93aa0c4f5fec06f))
* **documents:** saving documents on a temp ignored folder on development ([6db6f72](https://github.com/irian-codes/chat-with-manuals/commit/6db6f721193fd3aac948c438c4ed6a3c6a765a04))
* **documents:** simulating document parsing in a fast way for now ([0a3c966](https://github.com/irian-codes/chat-with-manuals/commit/0a3c96646355154d5a4d13cf2c20205b8d31b890))
* **documents:** using proper function to check if file exists and cleanup ([6dedb72](https://github.com/irian-codes/chat-with-manuals/commit/6dedb72a29e35d50c22f351081d82b4318060f00))
* **files:** improved all file handling functions ([3843b15](https://github.com/irian-codes/chat-with-manuals/commit/3843b150345b1a3f53a98db6a7da4b361310c348))
* **trpc:** added missing dbUser on SSG context ([efca69b](https://github.com/irian-codes/chat-with-manuals/commit/efca69ba3d00298d6102dc579de9f06ec9aed156))

## [0.1.4](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.3...v0.1.4) (2024-12-09)


### Features

* **cancel-document:** added the TRPC procedure for cancelling document parsing ([927d7ef](https://github.com/irian-codes/chat-with-manuals/commit/927d7ef22a2540efd9eac2c3e5a5faf9920fcedc))
* **conversations:** added TRPC procedure and behaviours to add a conversation and navigate to it ([d47f463](https://github.com/irian-codes/chat-with-manuals/commit/d47f463c7f9a55e6f8e941fb73738ed5111b16f7))
* **conversations:** adding message by using TRPC ([4d41a40](https://github.com/irian-codes/chat-with-manuals/commit/4d41a4060a7f00220e1a526ca00763e6f7569697))
* **conversations:** loading conversations with TRPC ([144aec7](https://github.com/irian-codes/chat-with-manuals/commit/144aec7eb5f89ab8090b5aae01cefa02448d75e7))
* **delete-document:** added the TRPC procedure for deleting document ([3e15d2a](https://github.com/irian-codes/chat-with-manuals/commit/3e15d2a7654a3828fa1a554808b720ca48d90600))
* **edit-document:** added the TRPC procedure for editing document details ([826f3d1](https://github.com/irian-codes/chat-with-manuals/commit/826f3d13193cb9222ca0db58a07db3af013412f1))
* **trpc:** migrated the home page to TRPC routers ([7853c15](https://github.com/irian-codes/chat-with-manuals/commit/7853c154236318df051ced09f47b05d0543e4feb))
* **upload-document:** uploading document file to TRPC using FormData ([7b1c525](https://github.com/irian-codes/chat-with-manuals/commit/7b1c5259e025fab4c1a9d48ba4c8fd59b79f416a))


### Bug Fixes

* **lang:** unified word 'title' to refer to the document title or name in all languages ([3317e20](https://github.com/irian-codes/chat-with-manuals/commit/3317e2027e41b1bb906ddb0db94fdac64128d783))
* **server:** don't rate limit when on development ([3c0a18a](https://github.com/irian-codes/chat-with-manuals/commit/3c0a18abd38807546bc8c1746e2c2bf1af883676))

## [0.1.3](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.2...v0.1.3) (2024-12-05)


### Features

* **sidebar:** created ConversationsSidebarContext and hiding language switcher when opened ([980e2d8](https://github.com/irian-codes/chat-with-manuals/commit/980e2d83117a83b66ec26bd6dad7e98d050eeae5))
* **sidebar:** made sidebar collapse with a button ([e3e828b](https://github.com/irian-codes/chat-with-manuals/commit/e3e828b04aa180af630955c14aafb77399f9c839))


### Bug Fixes

* **dashboard:** fixed inconsistent document card height ([c428e61](https://github.com/irian-codes/chat-with-manuals/commit/c428e610652241203f66a51b3cda86470e6c69f8))
* **dashboard:** support for user logged out state ([75aa1d1](https://github.com/irian-codes/chat-with-manuals/commit/75aa1d1f82f9a1d38aecc0ac73b72ddc88e534a6))
* **deps:** pin radix-ui scroll area version for now ([7ca3ede](https://github.com/irian-codes/chat-with-manuals/commit/7ca3ede5d2b47cba7ddb30ac9697649b618d70ae))
* **header:** only hiding language switcher on mobile screens ([c362c5e](https://github.com/irian-codes/chat-with-manuals/commit/c362c5ec645c8fcf48f2062c588739f49a7339ad))
* **lang:** flag not overlapping anymore with other elements ([b5984b7](https://github.com/irian-codes/chat-with-manuals/commit/b5984b78f6a9f063da619b3f6a3e9cbd8aedfca0))
* **modals:** made modals correctly responsive ([0673be0](https://github.com/irian-codes/chat-with-manuals/commit/0673be002e1c0153e825ea5da10393d70f199357))
* **sidebar:** properly hiding the main content on mobile when sidebar is open ([028c8f3](https://github.com/irian-codes/chat-with-manuals/commit/028c8f3470910435ecee81d84efe5a96ec72e4f4)), closes [#7](https://github.com/irian-codes/chat-with-manuals/issues/7)

## [0.1.2](https://github.com/irian-codes/chat-with-manuals/compare/v0.1.1...v0.1.2) (2024-11-20)


### Features

* **conversation:** added conversation non functional ui ([699af8c](https://github.com/irian-codes/chat-with-manuals/commit/699af8c1ff2745908d6aa1efee3af7a71c695c97))
* **conversation:** added i18n to conversation UI ([7c5dd2c](https://github.com/irian-codes/chat-with-manuals/commit/7c5dd2c8127eef9eabb6a3d103bb4e9ee0982860))
* **conversation:** focusing input when message received ([a60e42a](https://github.com/irian-codes/chat-with-manuals/commit/a60e42ab0806039b87ac5ee4c581358d14bf6738))
* **conversation:** improved conversation input bar ([79ab9e6](https://github.com/irian-codes/chat-with-manuals/commit/79ab9e6ad37b7c2b813f0de749f4890b6e747e6b))
* **conversation:** only show Ctrl+Enter hint to send message when appropiate ([5b89851](https://github.com/irian-codes/chat-with-manuals/commit/5b89851e4c0992e446cfa04ca8e899171eb02a1f))
* **conversations:** added modal for new conversation button on the sidebar ([316411d](https://github.com/irian-codes/chat-with-manuals/commit/316411d5d3d7ba848bb67d522fd9e840e871c394))
* **conversation:** scrolling to last message when message sent/received ([ddb0c8f](https://github.com/irian-codes/chat-with-manuals/commit/ddb0c8fe4eeb569e4ac6dd644ee753677e106d01))
* **converstion:** added message loading animation ([90223fa](https://github.com/irian-codes/chat-with-manuals/commit/90223fa2e88618ea5e8e859ecdfcd87e72bbd089))
* **dashboard:** added edit document modal ([1b313db](https://github.com/irian-codes/chat-with-manuals/commit/1b313db5e104ab636f8c6fb3b9f112eb26b7f723))
* **dashboard:** added link to dashboard documents to conversation ([fb115a1](https://github.com/irian-codes/chat-with-manuals/commit/fb115a1048dfb2dc39daa20b0487fc4917df499a))
* **dashboard:** added upload document modal ([9b03b60](https://github.com/irian-codes/chat-with-manuals/commit/9b03b609f5bd464b18ff2bbe2548c050d39b8aa2))
* **lang:** added full i18n to the project ([8bdc1ea](https://github.com/irian-codes/chat-with-manuals/commit/8bdc1ea62be931bc9cd6bd4c8246ffea8d2f51c9))
* **lang:** added initial localization data and set up i18nAlly ([c9b073e](https://github.com/irian-codes/chat-with-manuals/commit/c9b073e91ce2895e4b8113b4b4bf185d595ff6bd))
* **lang:** added LanguageSwitcher component ([dbe2634](https://github.com/irian-codes/chat-with-manuals/commit/dbe2634f837ae5e9b01763de7722740822bd873f))
* **lang:** formatting dates correctly with i18n ([d3d5167](https://github.com/irian-codes/chat-with-manuals/commit/d3d5167cca1f4bbcca88bc5619f4e8bc06623aee))


### Bug Fixes

* **config:** using new way of allowing remote domains in config ([b0e484c](https://github.com/irian-codes/chat-with-manuals/commit/b0e484c9d4ed407848e0993cc8c32ed16df5c080)), closes [#4](https://github.com/irian-codes/chat-with-manuals/issues/4)
* **conversation:** applied theme rounding (md) ([e0b72f0](https://github.com/irian-codes/chat-with-manuals/commit/e0b72f0bd154cd103ee8a27b3273017cc258a883))
* **dashboard:** add missing shallow routing declaration ([3c9164c](https://github.com/irian-codes/chat-with-manuals/commit/3c9164c81f9f10ea48abb0d7dd463f230b832888))
* **dashboard:** added missing button type to Cancel buttons ([c2671de](https://github.com/irian-codes/chat-with-manuals/commit/c2671deabf9fd2912f249af6504c5bb27a1ca677))
* **dashboard:** put more appropiate icon for document card ([34b7139](https://github.com/irian-codes/chat-with-manuals/commit/34b71390d83582fb609c701ce190af58640bf91a))
* **lang:** displaying lang flags as SVG ([046ccd1](https://github.com/irian-codes/chat-with-manuals/commit/046ccd178a5d3455025271b728874cd382ab0812))
* **navigation:** added conversation URL when clicking the sidebar ([598c809](https://github.com/irian-codes/chat-with-manuals/commit/598c8093a5bc5e7889e66e728c8d30c134daca11))

## 0.1.1 (2024-11-14)


### Features

* created main layout wrapper component ([1826855](https://github.com/irian-codes/chat-with-manuals/commit/1826855587b6aeb57df80c21e206a9b58a7fc8b8))
* **dashboard:** added Clerk user avatar button ([cac325c](https://github.com/irian-codes/chat-with-manuals/commit/cac325c544ff1f01bff06f206dd850cb784db1d7))
* **dashboard:** added image component for docs ([6f4d751](https://github.com/irian-codes/chat-with-manuals/commit/6f4d751e9beec407cc2d703cc8805b50c395d2e7))
* **layout:** added v0 raw generated dashboard page ([c9661ac](https://github.com/irian-codes/chat-with-manuals/commit/c9661ac4c313b173ea0998b92e1751835b573f5f))


### Bug Fixes

* **dashboard:** added a gap on header ([a07f65b](https://github.com/irian-codes/chat-with-manuals/commit/a07f65b985bc75a6610b8c78912010180db368b8))
* **dashboard:** positioned content in a responsive way ([84d226d](https://github.com/irian-codes/chat-with-manuals/commit/84d226d5148edf6c092833ca17db2ec7ca92d367))
* truncating text on /dashboard ([eeb30bd](https://github.com/irian-codes/chat-with-manuals/commit/eeb30bd0da06f3b879c754527c8701c558e21772))
* **ui:** moved new conversation button to a nicer place ([c8419ca](https://github.com/irian-codes/chat-with-manuals/commit/c8419ca88874889d91cbf4fcd56b143a4784ccea))

## 0.1.0 (2024-11-11)


### Features

* Added Clerk Auth ([15681dc](https://github.com/irian-codes/chat-with-manuals/commit/15681dce3145630f6c301cbcb3776fed6d8f96d9))
* Implemented rate limiter ([9195089](https://github.com/irian-codes/chat-with-manuals/commit/91950895e4dfb3f2d07360e4f3908d1daa86f845))
