import { useState } from 'react'
import { Copy, Check, Container } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import styles from './DockerUpdateModal.module.css'

const GUIDE_URL = 'https://github.com/tonywied17/plex-poster-set-helper-2/blob/main/docker/README.md#updating-to-a-new-version'

/**
 * A copyable block of shell commands.
 *
 * Copy is best-effort: the clipboard API only works on a secure page (the https
 * port), so on plain http the text is still selectable by hand instead.
 */
function CmdBlock({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked on http - the text stays selectable */ }
  }
  return (
    <div className={styles.cmd}>
      <pre className={styles.cmdText}>{lines.join('\n')}</pre>
      <button className={styles.copyBtn} onClick={copy} title="Copy commands">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  )
}

/**
 * Step-by-step update instructions for the Docker / unraid build.
 *
 * The containerized app is viewed from a browser on another machine, so the
 * host has no desktop and openExternal can't surface a guide. These commands
 * run on the Docker host (which we can't detect from inside the container), so
 * every method is listed and the user picks the one that matches their setup.
 */
export default function DockerUpdateModal({ open, onClose, version }: {
  open: boolean
  onClose: () => void
  version?: string
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={version ? `Update to v${version}` : 'Update your container'}
      description="Your settings, schedules, and history live in the config volume and are never touched. Pull the latest, rebuild, and restart on whichever machine runs Docker."
    >
      <div className={styles.methods}>
        <div className={styles.method}>
          <div className={styles.methodHead}><Container size={13} /> unraid (template install)</div>
          <p className={styles.methodBody}>
            Open the <strong>Docker</strong> tab, click the container, and choose <strong>Force update</strong>.
            It pulls the latest image from Docker Hub and restarts - no commands needed.
          </p>
        </div>

        <div className={styles.method}>
          <div className={styles.methodHead}>Windows (PowerShell)</div>
          <CmdBlock lines={['git pull', './docker/run.ps1 -Build']} />
        </div>

        <div className={styles.method}>
          <div className={styles.methodHead}>Mac / Linux</div>
          <CmdBlock lines={['git pull', './docker/run.sh --build']} />
        </div>

        <div className={styles.method}>
          <div className={styles.methodHead}>Docker Compose</div>
          <CmdBlock lines={['git pull', 'docker compose -f docker/docker-compose.yml up -d --build gui']} />
        </div>

        <div className={styles.method}>
          <div className={styles.methodHead}>Full guide</div>
          <CmdBlock lines={[GUIDE_URL]} />
        </div>
      </div>
    </Modal>
  )
}
