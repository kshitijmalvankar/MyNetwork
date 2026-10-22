import Link from "next/link";
import type { Metadata } from "next";
import { ContactEmail, LegalDocument } from "@/components/legal/legal-document";
import { legalDetails } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  const { operator, governingLaw } = legalDetails();
  return (
    <LegalDocument title="Terms of service">
      <p>
        These terms are the agreement between you and {operator} (&ldquo;we&rdquo;) for using MyNetwork. By creating an
        account you accept them. Please also read the <Link href="/privacy">privacy policy</Link>, which explains how we
        handle your information.
      </p>

      <h2>The service</h2>
      <p>
        MyNetwork lets you scan business cards, keep contacts, notes and voice notes, and use AI features to search and
        make sense of your network. Accounts are free and come with monthly allowances for AI features, shown in
        Settings → Usage. We may change the allowances or features over time. If we introduce paid plans, they&apos;ll
        come with their own terms, and nothing will be charged without your agreement.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 16 years old.</li>
        <li>Give a real email address and keep your password, and your authenticator if you use one, safe.</li>
        <li>You&apos;re responsible for what happens in your account. Tell us straight away if you think someone else has used it.</li>
        <li>One person per account. Don&apos;t share it or sell access to it.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you add stays yours. You give us permission to store and process it only as needed to run MyNetwork for
        you, including sending it to the AI providers described in the privacy policy. That permission ends when you
        delete the content or your account.
      </p>

      <h2>Other people&apos;s information</h2>
      <p>Much of what you store is about other people. When you add it, you agree that:</p>
      <ul>
        <li>you have a good reason to keep it, for example because they gave you their card;</li>
        <li>you&apos;ll follow the data protection and privacy laws that apply to you;</li>
        <li>you won&apos;t use MyNetwork to send spam or unwanted bulk messages, or to build lists to sell or share;</li>
        <li>you&apos;ll delete someone&apos;s details if they ask you to and you have no other right to keep them.</li>
      </ul>

      <h2>Fair use</h2>
      <p>Don&apos;t:</p>
      <ul>
        <li>break the law or store content you have no right to;</li>
        <li>try to get into other accounts, test or break our security, or get around allowances and limits;</li>
        <li>use bots, scripts or scraping to access the service, or put an unreasonable load on it;</li>
        <li>copy, resell or build a competing service from MyNetwork.</li>
      </ul>
      <p>
        If you think you&apos;ve found a security problem, please tell us at <ContactEmail /> rather than testing it
        further.
      </p>

      <h2>AI features</h2>
      <p>
        Card reading, Ask, briefs, drafts, voice note summaries and insights are produced by AI and can be wrong or
        incomplete. Check anything important before you rely on it. MyNetwork never sends messages for you: drafts and
        suggestions are only shown to you.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep MyNetwork running and your data safe, but we can&apos;t promise the service will always be
        available or free of errors. Keep your own copy of anything you can&apos;t afford to lose; you can download
        your contacts at any time from Settings → Your data. We may change or stop parts of the service. If we ever shut
        MyNetwork down, we&apos;ll give you at least 30 days&apos; notice so you can download your data.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time from Settings → Your data; everything in it is deleted as described in
        the privacy policy. We may suspend or close accounts that break these terms or put the service or other people
        at risk. Where reasonable, we&apos;ll warn you first and give you a chance to download your data.
      </p>

      <h2>Liability</h2>
      <p>
        MyNetwork is provided &ldquo;as is&rdquo;. To the extent the law allows, we aren&apos;t liable for indirect or
        consequential losses, such as lost business or opportunities, or for losses caused by AI output you relied on
        without checking. Nothing in these terms limits liability that can&apos;t be limited by law, or any rights you
        have as a consumer.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If we change these terms, we&apos;ll update the date at the top and, for significant changes, tell you in the
        app or by email before they take effect. If you keep using MyNetwork after that, the new terms apply. If you
        don&apos;t agree, you can delete your account.
      </p>

      <h2>Law and contact</h2>
      <p>
        These terms are governed by the laws of {governingLaw ?? "[governing law]"}, without taking away any protection
        you have under the laws of the country where you live. Questions about these terms go to <ContactEmail />.
      </p>
    </LegalDocument>
  );
}
