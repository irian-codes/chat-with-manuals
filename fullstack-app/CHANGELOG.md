# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

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
