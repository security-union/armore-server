# Contributing to Armore

🍻🎉 Welcome! First off, thanks for taking the time to contribute! 🎉🍻

Feel free to contribute regardless of your age, gender, race or any other discriminating factor (Check out [code of conduct](./CODE_OF_CONDUCT.md) for more) and contact us on [discord](https://discord.gg/mptG9ZGxTF) if you have any questions, we are glad to have you here!

## How to contribute?

Armore is divided into 4 main repositories: _Android_, _iOS_, _Server_ & _Web_.
For now we are mainly open sourcing the Server repo to the community. If you are interested in collaborating with the android, iOS or Web code (which we will open soon) contact us!

You can collaborate with us by reporting **issues**, opening **pull requests** working on one or more issues, or contributing new **ideas/suggestions** in our discord server!

### Issues

Feel free to open an issue whenever:

- You want to report a **bug**
- You want to suggest **enhancements**
- You would like to add a **feature**

Make sure to use a clear and descriptive title for the issue.
Always try to write a description that helps us as much as possible to understand the bug/enhancement/feature you want to report. **Don't be shy!** Add as many details as you think necessary.

Also, **we will be opening issues** in which you will be able to collaborate:

- **Good first issues**:

  It may be the best option to get you started in the project. They will help you practice and become familiar with the code.

* **Help wanted issues**:

  These issues can be a little more challenging! They are probably priority tasks that we haven't had the time to do yet, or tasks we have in progress that we need help with!

### Pull requests

We will consider any contribution you do! But please, make sure to follow these steps before doing it:

- Always **reference the issue/s** you are working on. If no issue is related to your work, make sure to create one describing what you are trying to solve/improve and then link your pull request to it!

- Follow the **styleguides**
- After you submit your pull request, verify that **all status checks are passing**

> If a status check is failing, and you believe that the failure is unrelated to your change, please leave a comment on the pull request explaining why you believe the failure is unrelated. We will re-run the status check for you. If we conclude that the failure was a false positive, then we will open an issue to track that problem.

While the prerequisites above must be satisfied prior to having your pull request reviewed, we may ask you to complete additional design work, tests, or other changes before your pull request can be ultimately accepted!

Make sure to **squash** your pull request commits before merge. Leave one simple and clean commit message that describes shortly what the pull request was for.

## Styleguides

### Git commit messages

- Reference issues and pull requests liberally after the first line
- Consider starting the commit message with an applicable emoji:
  - 🎨 `:art:` when improving the format/structure of the code
  - ⚡️ `:zap:` when improving performance
  - 📝 `:memo:` when writing docs
  - 🐛 `:bug:` when fixing a bug
  - 🔥 `:fire:` when removing code or files
  - 💚 `:green_heart:` when fixing the CI build
  - ✅ `:white_check_mark:` when adding tests
  - 🔒 `:lock:` when dealing with security
  - ⬆️ `:arrow_up:` when upgrading dependencies
  - ⬇️ `:arrow_down:` when downgrading dependencies

Check out the entire [gitmojis list](https://gitmoji.dev/) for more!

### Branch naming

For now we use Jira as our main project management tool. Therefore, most of the branches we create contain the name of the ticket they are intended to solve.

For example: _ARM-197_

However, as an external developer who wants to contribute to the project, we suggest that you use a convention to help us understand the purpose of the branch you want to create.

- feat - New feature.
- bugfix - Code changes linked to a known issue.
- hotfix - Quick fixes to the codebase.
- test - adding tests to the codebase.
- junk - Experiments (will never be merged).
