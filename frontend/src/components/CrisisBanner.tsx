import CrisisDialog from './CrisisDialog';

/** Kept for backward compatibility with older call sites; now just the shared dialog. */
export default function CrisisBanner({ onClose }: { onClose: () => void }) {
  return <CrisisDialog urgent onClose={onClose} />;
}
