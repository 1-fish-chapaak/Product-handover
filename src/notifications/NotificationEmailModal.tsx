import { Mail } from 'lucide-react';
import Modal from '../components/shared/Modal';
import EmailDocument from './EmailDocument';
import { eventById } from './catalogue';
import type { EmailMessage } from './types';

/** The email as sent, in its own modal (used when an email is opened outside
 *  the preferences screen). Preferences swaps the same document in place. */
export default function NotificationEmailModal({ email, onClose, onOpenLink }: {
  email: EmailMessage;
  onClose: () => void;
  onOpenLink?: (email: EmailMessage) => void;
}) {
  const def = eventById(email.eventId);
  return (
    <Modal
      title={email.subject}
      subtitle={<span className="inline-flex items-center gap-1.5"><Mail size={12} aria-hidden="true" /> Email · {email.eventId} · {def?.module}</span>}
      width="max-w-[760px]"
      onClose={onClose}
      ariaLabel="Email preview"
      footer={<button onClick={onClose} className="h-9 px-4 rounded-md text-[0.8125rem] font-semibold text-ink-700 border border-canvas-border hover:bg-canvas cursor-pointer">Close</button>}
    >
      <EmailDocument email={email} onOpenLink={onOpenLink} />
    </Modal>
  );
}
