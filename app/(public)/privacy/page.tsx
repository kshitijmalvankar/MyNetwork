import Link from "next/link";
import type { Metadata } from "next";
import { ContactEmail, LegalDocument } from "@/components/legal/legal-document";
import { legalDetails } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  const { operator } = legalDetails();
  return (
    <LegalDocument title="Privacy policy">
      <p>
        MyNetwork helps you keep track of the people you meet: you scan their business cards, add notes and ask
        questions about your network. This policy explains what we store, why, who helps us run the service, and the
        choices you have. MyNetwork is run by {operator} (&ldquo;we&rdquo;). Questions go to <ContactEmail />.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>We use your information only to run MyNetwork for you. We don&apos;t sell it, show ads or use it to train AI models.</li>
        <li>Contact details, notes, voice notes, card photos and chats are encrypted before they&apos;re saved.</li>
        <li>AI features use providers that have agreed not to keep or train on what we send them.</li>
        <li>You can download your contacts or delete your account and everything in it at any time, from Settings.</li>
      </ul>

      <h2>What we store</h2>
      <h3>About you</h3>
      <ul>
        <li>
          Your email address and a securely hashed password; the password itself is never stored. New passwords are
          checked against known data breaches (Have I Been Pwned) using only a short fragment of their hash, so the
          password never leaves our servers.
        </li>
        <li>Your display name, time zone and default phone country, if you set them.</li>
        <li>Your authenticator app setup, if you turn on two-step sign-in.</li>
      </ul>
      <h3>What you add</h3>
      <ul>
        <li>Photos of business cards and the details read from them.</li>
        <li>Contacts, companies and events, and the notes, follow-ups and voice notes you add to them.</li>
        <li>Your questions in Ask and the answers, so you can return to a chat.</li>
        <li>AI suggestions, meeting briefs and the Insights summary, so they don&apos;t have to be made again.</li>
      </ul>
      <h3>To keep the service safe and fair</h3>
      <ul>
        <li>
          A security log of sign-ins and account changes, with your browser type and a scrambled (hashed) form of your
          network address. You can see it in Settings → Security.
        </li>
        <li>How much of each monthly allowance you&apos;ve used, and the size and cost of each AI request.</li>
        <li>Short-lived counters that limit repeated attempts, kept for at most an hour.</li>
      </ul>
      <p>
        We use only the cookies needed to keep you signed in and to confirm it&apos;s you before sensitive changes.
        Your light or dark theme choice is saved in your browser. There are no advertising or analytics trackers.
      </p>

      <h2>How it&apos;s protected</h2>
      <ul>
        <li>All traffic is encrypted in transit (HTTPS).</li>
        <li>
          Email addresses, phone numbers, street addresses, notes, voice recordings and transcripts, card photos, chats
          and AI-written text are encrypted with a key unique to your account (AES-256) before they&apos;re saved.
        </li>
        <li>
          Names, job titles, companies, cities, countries and event names are stored without that extra layer, so you
          can search, filter and see your network map. Like everything else, they&apos;re protected by our hosting
          provider&apos;s storage encryption and by access rules that let only you see your data.
        </li>
        <li>
          To find notes by meaning, we keep search fingerprints (lists of numbers calculated from your text). They
          aren&apos;t encrypted with your key, and they reveal something about the topics in your notes, though not the
          text itself.
        </li>
        <li>Downloading your data, deleting your account and changing security settings ask for your password again.</li>
      </ul>
      <p>
        We don&apos;t look at your content. The people who run the service can technically reach it, so access is
        limited to what&apos;s needed to keep MyNetwork working, fix problems you report, or meet a legal obligation.
      </p>

      <h2>How AI is used</h2>
      <p>
        AI requests go through OpenRouter to model providers that have committed to zero data retention: they process
        each request and don&apos;t store it or use it for training. Only what a feature needs is sent:
      </p>
      <ul>
        <li><strong>Reading a card:</strong> the card photo.</li>
        <li><strong>Ask:</strong> your question, recent messages in the chat, and the contacts and note excerpts that match it.</li>
        <li><strong>Briefs and drafts:</strong> the person&apos;s details, your notes about them and related people.</li>
        <li><strong>Voice notes:</strong> the recording.</li>
        <li><strong>Follow-up suggestions:</strong> the text of a typed note that mentions a date or a promise.</li>
        <li><strong>Search:</strong> the text of contacts, notes and events, to make the search fingerprints above.</li>
        <li><strong>Insights summary:</strong> counts and the names of companies, events, roles and places. No one&apos;s name or details.</li>
      </ul>
      <p>
        AI never sends anything on your behalf. Suggestions, drafts and follow-ups appear in the app for you to accept,
        edit or ignore.
      </p>

      <h2>Other people&apos;s details</h2>
      <p>
        Most of what you store is about other people: the contact details printed on their cards and your notes about
        them. We store and process it on your behalf, only for you, and never contact them. Please keep only details you
        have a good reason to keep, such as cards people handed you, and respect their wishes if they ask you to delete
        them. Because this information belongs to your account and is encrypted with your key, we generally can&apos;t
        act on it directly; if someone contacts us about their information, we&apos;ll help where we can.
      </p>

      <h2>Who helps us run MyNetwork</h2>
      <ul>
        <li><strong>Supabase</strong> stores the database, sign-in and files, in the European Union (Ireland).</li>
        <li><strong>Vercel</strong> hosts the app and runs the server code.</li>
        <li>
          <strong>OpenRouter</strong> and the AI providers it routes to (currently Anthropic, Google and Microsoft Azure)
          process AI requests without keeping them.
        </li>
        <li><strong>Cloudflare Turnstile</strong> checks that sign-ins and sign-ups come from a person, not a bot.</li>
        <li><strong>Upstash</strong> holds the short-lived attempt counters.</li>
        <li>An email provider sends sign-up confirmations and password resets.</li>
      </ul>
      <p>
        Some of these companies process data in other countries, including the United States. Where that applies, we
        rely on their standard data protection terms for international transfers.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your data stays until you delete it. Deleting a contact or note removes it, and its photos or recordings, straight away.</li>
        <li>
          Deleting your account removes everything straight away. Encrypted copies in our database backups are removed
          as those backups expire, within 30 days.
        </li>
        <li>
          After an account is deleted we keep only a record that it was deleted (an account number and the date, with no
          email or other details) and the AI usage totals, which no longer link to anyone.
        </li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul>
        <li><strong>See and download:</strong> everything is visible in the app, and Settings → Your data downloads your contacts as a spreadsheet.</li>
        <li><strong>Correct:</strong> edit any contact, note or setting.</li>
        <li><strong>Delete:</strong> delete anything you&apos;ve added, or your whole account from Settings → Your data.</li>
        <li>
          <strong>Ask us:</strong> for a copy of your data, or about anything in this policy, write to <ContactEmail />.
          Depending on where you live, you may also have the right to object to or restrict how we use your data, and to
          complain to your data protection authority.
        </li>
      </ul>

      <h2>Children</h2>
      <p>MyNetwork is not meant for anyone under 16, and we don&apos;t knowingly create accounts for them.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we&apos;ll update the date at the top. For significant changes we&apos;ll tell you in
        the app or by email before they take effect. See also our <Link href="/terms">terms of service</Link>.
      </p>
    </LegalDocument>
  );
}
