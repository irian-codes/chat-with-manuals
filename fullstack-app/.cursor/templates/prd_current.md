# PRD: Development Mode Disclaimer Modal

## 1. Overview
This document outlines the requirements, design, and implementation plan for a blocking disclaimer modal that appears every time a user accesses any URL in the app. This modal is intended for development mode to warn users about the unsecure nature of data processing in the application.

## 2. Problem Statement
The application is currently in development and is not deployed in a secure production environment. Users must be clearly warned not to upload or use sensitive/confidential information since all data is not secure. Enforcing this acknowledgement via a modal helps mitigate potential accidental data exposure and reminds users of the risks.

## 3. Goals
- Ensure the disclaimer modal is displayed on all pages for any user who has not acknowledged the warning.
- Force explicit user interaction before access to the rest of the app (modal is not dismissable by clicking outside).
- Provide a checkbox labeled "don't show this again" that, when selected, prevents the modal from reappearing for 14 days by storing consent in LocalStorage.
- Use a dismiss button labeled "I understand" that records consent based on the checkbox selection.

## 4. Scope
### In Scope
- Creation of a modal using the app's existing Dialog component (inspired by UpdateDocumentModal).
- Implementation of persistent consent using LocalStorage with a 14-day expiration.
- Blocking user access until the modal is explicitly dismissed via the "I understand" button.

### Out of Scope
- Persisting the consent on the server side or saving it in a database.
- Additional features such as analytics tracking or dynamic content adjustments.

## 5. Detailed Requirements
### Functional Requirements
- On every page load, check LocalStorage for a valid consent flag with a timestamp not older than 14 days.
- If such a flag is absent or expired, display a modal that blocks any access to the application's content.
- The modal must contain:
  - The disclaimer text:

    **Development Mode Warning**

    This application is currently in development and is not yet deployed in a secure production environment. **All data processed by this app is not secure.**

    **Please note:**

    - **Do not upload any sensitive or confidential documents.**
    - **Avoid entering any sensitive information in chat conversations.**
    - **Be aware that data within this app may be exposed or accessed publicly.**

    By using this application, you acknowledge that you are doing so at your own risk. For your safety and privacy, please limit usage to non-sensitive, non-confidential data until the app is fully launched in a secure environment.

    *Thank you for your understanding and cooperation.*

  - A checkbox with the label "don't show this again".
  - A dismiss button labeled "I understand".
- When the user clicks "I understand":
  - If the checkbox is checked, record consent in LocalStorage with an expiration timestamp set to 14 days from the time of acceptance.
  - Dismiss the modal and allow access to the app.

### UI/UX Requirements
- The modal design should follow the styling and structure of the app's existing Dialog components (e.g., as seen in UpdateDocumentModal).
- The modal should block interactions outside its boundary; it is not dismissable by clicking on the backdrop.
- All text and button styles should align with the current app design guidelines using Shadcn UI and Tailwind CSS.

## 6. Implementation Considerations
- Integrate consent-checking logic at a high level (e.g., app layout or main wrapper) to ensure the modal is evaluated on every page load.
- Use LocalStorage for persisting the consent flag, ensuring it includes an expiration timestamp.
- Implement a mechanism to verify the expiration of the consent flag and, if expired, re-show the modal.
- Handle edge cases where LocalStorage might be disabled or unavailable.

## 7. Success Metrics
- The modal is displayed consistently on every page for users who have not confirmed the disclaimer.
- Once confirmed (with the checkbox selected), the modal does not appear again for 14 days.
- Users are unable to interact with the application until they acknowledge the disclaimer.
- The modal respects the app's design guidelines and offers a seamless user experience across devices.

## 8. Risks and Dependencies
- Users with disabled LocalStorage may continue to see the modal, impacting user experience.
- Future changes to consent policies might require rethinking storage mechanisms or UI updates.

## 9. Future Considerations
- Optionally add analytics to track modal acknowledgements.
- Revisit consent persistence mechanisms if the app transitions from development to production.

## 10. Open Questions / Clarifications
- The current decision is to use LocalStorage to store the consent flag over cookies for broader compatibility.
- No additional tracking or backend storage of consent is required at this stage.

## 11. Implementation Plan

### Phase 1: Setup & Basic Modal Integration
- Task 1: Develop a new modal component (e.g., DisclaimerModal) using the app's existing Dialog component (inspired by UpdateDocumentModal) to display the disclaimer text and UI elements.
- Task 2: Integrate a high-level consent check in the main app layout to verify if a valid LocalStorage consent flag (with a 14-day expiration) exists.
- Task 3: Ensure that the modal is blocking and prevents any interaction with the app until the user clicks the "I understand" button.

### Phase 2: Functionality Enhancement
- Task 1: Add the "don't show this again" checkbox within the modal.
- Task 2: Implement the event handler for the "I understand" button to check the state of the checkbox and, if selected, record the consent in LocalStorage with an expiration timestamp set to 14 days from acceptance.

### Phase 3: Testing & Final Integration
- Task 1: Perform manual testing across various pages and scenarios (including cases where LocalStorage is unavailable) to ensure the modal behaves as expected.
- Task 2: Refine the styling and accessibility aspects to fully align with the Shadcn UI and Tailwind CSS guidelines.
- Task 3: Conduct a final code review to ensure the implementation remains lean, maintainable, and adheres to best practices. 