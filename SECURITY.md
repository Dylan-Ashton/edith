# Security

## Reporting a vulnerability

Please report security problems privately through GitHub, not in a public issue:

1. Open the [Security tab](https://github.com/Dylan-Ashton/edith/security) of this repository.
2. Click **Report a vulnerability** and describe the problem: what an attacker could do, the Edith and macOS versions, and the steps or a sample file that shows it.

You will get a reply in the advisory thread. Please give a reasonable amount of time for a fix before disclosing it publicly.

## Supported versions

Only the latest release gets security fixes. Edith tells you when a newer version is out (Edith → Check for Updates…).

## What is in scope

Edith opens files from anywhere, so the most important issues are anything that lets a document (Markdown, HTML, Word, PDF or RTF):

- run code, or load a page in place of the app;
- read or write files the person did not open or save themselves;
- make Edith contact the network (its only request is the update check to the GitHub releases API).

Problems in the installer (`Install Edith.command`) are also in scope.
