# Frequently Asked Questions (FAQ)

Common questions about WhyKnot.live answered.

## Table of Contents

- [General](#general)
- [For Users](#for-users)
- [For Developers](#for-developers)
- [Technical](#technical)
- [Contributing](#contributing)
- [Privacy & Security](#privacy--security)

---

## General

### What is WhyKnot.live?

WhyKnot is a curated platform for discovering innovative websites, creative tools, and inspiring web experiences. Think of it as a carefully curated collection of the web's hidden gems, design inspiration, and useful tools.

### Who is WhyKnot for?

WhyKnot is for:
- **Designers** seeking inspiration
- **Developers** looking for new tools
- **Creators** discovering resources
- **Entrepreneurs** finding solutions
- **Anyone** who loves exploring the web

### When will WhyKnot launch?

- **Alpha Access**: December 19, 2025 (for waitlist members)
- **Public Launch**: October 9, 2026 (for everyone)

### How do I join the waitlist?

Visit [whyknot.live](https://whyknot.live) and enter your email in the waitlist form. You'll be notified when alpha access is available.

### Is WhyKnot free?

Yes! WhyKnot is free to use. We may introduce optional premium features in the future, but the core platform will always remain free.

### How is WhyKnot different from bookmarking services?

Unlike bookmark managers:
- **Curated**: Every website is reviewed and categorized
- **Discoverable**: Find websites you didn't know you needed
- **Community**: Benefit from collective curation
- **Organized**: Categories and tags make navigation easy
- **Social**: Share and discover through community

---

## For Users

### How do I search for websites?

*(Coming in Alpha)* Use the search bar to find websites by name, category, or tags. Advanced filters will help you narrow down results.

### Can I submit websites?

Yes! After the public launch, you'll be able to submit websites for review. Our team and community moderators will review submissions.

### How are websites selected?

We look for:
- **Innovation**: Unique approach or concept
- **Design**: Beautiful, thoughtful UI/UX
- **Utility**: Solves a real problem
- **Quality**: Well-maintained and functional
- **Originality**: Not just another clone

### Can I create collections?

Yes! *(Coming in Alpha)* You can:
- Bookmark favorite websites
- Create custom collections
- Share collections with others
- Export collections

### How do I follow other users?

*(Coming in Phase 5)* User profiles and following features will be available in Q2 2026.

### Can I comment on websites?

*(Coming in Public Launch)* Comments and ratings will be available in October 2026.

---

## For Developers

### Is there an API?

Not yet, but it's planned for Q1 2026. The API will allow developers to:
- Search and retrieve websites
- Access user collections
- Submit websites programmatically
- Integrate WhyKnot into their apps

### Will there be an API for free?

Yes, we'll have a free tier with reasonable rate limits. Higher-tier plans will be available for commercial use.

### Can I contribute to the codebase?

Absolutely! WhyKnot is open source. See our [Contributing Guide](../CONTRIBUTING.md) to get started.

### What tech stack does WhyKnot use?

- **Frontend**: Astro, TypeScript, Custom CSS
- **Backend**: Hono, Node.js, TypeScript
- **Database**: MongoDB
- **Hosting**: Vercel (frontend), Railway (backend)

See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

### Can I self-host WhyKnot?

Yes! You can clone the repository and run it yourself. See our [README](../README.md#getting-started) for setup instructions.

### Is there a WordPress plugin?

Not yet, but it's on our roadmap for Q1 2026.

### What about a browser extension?

A Chrome extension is planned for Q1 2026, with Firefox and Safari support following.

---

## Technical

### What browsers are supported?

WhyKnot works on:
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome for Android)

### Do I need to enable JavaScript?

Yes, JavaScript is required for the interactive features. However, we're working on progressive enhancement for basic functionality without JS.

### Is WhyKnot mobile-friendly?

Absolutely! The site is fully responsive and works great on all screen sizes.

### What about accessibility?

Accessibility is a priority. WhyKnot follows WCAG 2.1 AA guidelines:
- Keyboard navigation
- Screen reader support
- High contrast mode
- Semantic HTML
- ARIA labels where needed

### Does WhyKnot work offline?

Not yet, but offline support via Progressive Web App is planned for Q3 2026.

### Can I use WhyKnot without an account?

During alpha/beta, you'll need an account. After public launch, you can browse without an account, but you'll need one to bookmark, comment, or submit websites.

---

## Contributing

### How can I contribute?

There are many ways:
- **Code**: Fix bugs, add features
- **Design**: Improve UI/UX
- **Content**: Curate websites, write blog posts
- **Documentation**: Improve docs
- **Translation**: Help with internationalization
- **Testing**: Report bugs, test new features

See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.

### I'm not a developer. Can I still help?

Yes! Non-code contributions are valuable:
- Test the platform and report issues
- Suggest website additions
- Share feedback on user experience
- Help with documentation
- Spread the word

### Do I need to sign a CLA?

No, we don't require a Contributor License Agreement. By contributing, you agree to license your contributions under the MIT License.

### How do I report a bug?

Open a [bug report](https://github.com/jayptl-me/whyknot.live/issues/new?template=bug_report.md) on GitHub with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

### How do I request a feature?

Open a [feature request](https://github.com/jayptl-me/whyknot.live/issues/new?template=feature_request.md) on GitHub explaining:
- What you need
- Why it's useful
- How it should work

### Will my contribution be credited?

Yes! Contributors are acknowledged in:
- README.md
- CHANGELOG.md
- GitHub contributor graph
- (Future) Contributors page on the website

---

## Privacy & Security

### What data does WhyKnot collect?

We collect minimal data:
- **Waitlist**: Email address only
- **Users** *(future)*: Email, username, profile info (optional)
- **Analytics**: Anonymous usage statistics
- **No tracking**: We don't use intrusive tracking

See our [Privacy Policy](https://whyknot.live/privacy-policy) for details.

### Is my data secure?

Yes! We implement:
- HTTPS encryption
- Secure password hashing (bcrypt)
- Rate limiting
- Input validation
- Regular security audits

See [SECURITY.md](../SECURITY.md) for our security practices.

### Do you sell my data?

**Never.** We will never sell, rent, or share your personal data with third parties for marketing purposes.

### Can I delete my account?

*(Coming in Alpha)* Yes, you'll be able to delete your account and all associated data at any time through account settings.

### How do you handle security vulnerabilities?

We take security seriously. If you discover a vulnerability:
- **Don't** open a public issue
- **Do** report it privately via our [Security Policy](../SECURITY.md)
- We'll respond within 24 hours
- We'll credit you (if you wish) after resolution

### Is WhyKnot GDPR compliant?

Yes, we're designed with GDPR principles in mind:
- Data minimization
- Right to access
- Right to deletion
- Right to portability
- Transparent privacy policy

### Where is data stored?

- Database: MongoDB Atlas (AWS - US region)
- Backend: Railway (US region)
- Frontend: Vercel (Global CDN)

We may add EU data centers in the future.

---

## Business & Legal

### Who owns WhyKnot?

WhyKnot is created and maintained by [Jay Patel](https://github.com/jayptl-me) with contributions from the open-source community.

### What's the business model?

Currently, WhyKnot is:
- Free for all users
- Open source
- No ads

Future potential revenue:
- Premium features (optional)
- API commercial plans
- Enterprise solutions

### Can I use WhyKnot for commercial projects?

Yes! WhyKnot is licensed under the MIT License, which allows commercial use. The API (when available) will have commercial tiers.

### Can I white-label WhyKnot?

Since WhyKnot is open source, you can fork and customize it. However, please respect the license and give appropriate credit.

---

## Troubleshooting

### I didn't receive the waitlist confirmation email

Check:
- Spam/junk folder
- Email address spelling
- Wait a few minutes (it can take up to 10 minutes)

Still no email? [Contact us](https://whyknot.live/contact).

### The website isn't loading

Try:
- Refresh the page (Cmd/Ctrl + R)
- Clear cache (Cmd/Ctrl + Shift + R)
- Try a different browser
- Check your internet connection
- Visit [status page](https://status.whyknot.live) *(coming soon)*

### I found a broken link

Please [report it](https://github.com/jayptl-me/whyknot.live/issues/new) so we can fix it!

### The site looks broken on my device

Please [open an issue](https://github.com/jayptl-me/whyknot.live/issues/new?template=bug_report.md) with:
- Device/browser info
- Screenshot
- What looks wrong

---

## Community

### Is there a Discord/Slack?

Not yet, but we're considering it based on community interest. For now, use [GitHub Discussions](https://github.com/jayptl-me/whyknot.live/discussions).

### How can I stay updated?

- Join the [waitlist](https://whyknot.live)
- Watch the [GitHub repository](https://github.com/jayptl-me/whyknot.live)
- Follow updates in [CHANGELOG.md](../CHANGELOG.md)
- (Future) Newsletter subscription

### Can I write a blog post about WhyKnot?

Absolutely! We'd love that. Please [let us know](https://whyknot.live/contact) so we can share it!

### Are you hiring?

Not currently, but we welcome open-source contributors! Who knows where that might lead? 

---

## Still Have Questions?

We're here to help!

- [GitHub Discussions](https://github.com/jayptl-me/whyknot.live/discussions) - Ask the community
- [GitHub Issues](https://github.com/jayptl-me/whyknot.live/issues) - Report bugs
- [Contact Form](https://whyknot.live/contact) - Direct contact
- [Documentation](README.md) - Detailed guides

---

<div align="center">
 <p> Don't see your question here?</p>
 <p><strong><a href="https://github.com/jayptl-me/whyknot.live/discussions">Ask the community!</a></strong></p>
</div>

---

Last Updated: October 23, 2025
