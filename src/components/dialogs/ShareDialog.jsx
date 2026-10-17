/*  Gel-Calculator - Personalized fuel calculator for endurance athletes.
    Copyright (C) 2026  Eike Christian Karbe

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>. */


"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, ImageIcon, Link2 } from "lucide-react";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import Field, { CONTROL_CLASSES } from "../ui/Field";
import ShareImage from "./ShareImage";
import { copyText, shareUrl } from "./share";
import { useT } from "../../i18n/useT";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, SHARE_MODAL } from "../../state/UiProvider";

/**
 * The menu view: the share link (read-only, selectable, with "Copy link")
 * and the way to the recipe image.
 * @param {{ onCopy: () => void, onImage: () => void,
 *   imageButtonRef: import('react').RefObject<HTMLButtonElement|null> }} props
 */
function ShareMenu({ onCopy, onImage, imageButtonRef }) {
  const t = useT();
  const { inputs } = usePlanInputs();
  const linkId = useId();
  const imageId = useId();
  // Rendered only while the dialog is open (in the browser), so window is there.
  const url = useMemo(() => shareUrl(inputs), [inputs]);
  return (
    <div className="space-y-6">
      <section aria-labelledby={linkId} className="space-y-3">
        <h3 id={linkId} className="display-title text-ink">
          {t("ui-dialogs.share.link.heading")}
        </h3>
        <Field label={t("ui-dialogs.share.link.label")} hint={t("ui-dialogs.share.link.hint")}>
          {(controlProps) => (
            <input
              {...controlProps}
              type="url"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              data-testid="share-link"
              className={CONTROL_CLASSES}
            />
          )}
        </Field>
        <Button variant="primary" icon={Link2} onClick={onCopy} fullWidth>
          {t("ui-dialogs.share.copy")}
        </Button>
      </section>
      <section aria-labelledby={imageId} className="space-y-3 border-t border-line pt-4">
        <h3 id={imageId} className="display-title text-ink">
          {t("ui-dialogs.share.image.heading")}
        </h3>
        <p className="text-body-sm text-ink-2">{t("ui-dialogs.share.image.text")}</p>
        <Button ref={imageButtonRef} icon={ImageIcon} onClick={onImage} fullWidth>
          {t("ui-dialogs.share.image.open")}
        </Button>
      </section>
    </div>
  );
}

/**
 * The share dialog, on the `Dialog` primitive, with two views
 * (`useUi().shareView`; opening it always starts on the menu):
 *
 * - **Menu** ("Share"): the share link of the current inputs (share codec
 *   v4 in the `?s=` parameter, `encodeShareState`), shown read-only so it
 *   can be selected by hand, and "Copy link", which copies it (Clipboard
 *   API, else `execCommand('copy')`), closes the dialog and confirms with a
 *   toast; a failure keeps the dialog open and says so. "Make an image"
 *   goes to the image view.
 * - **Image** ("Recipe image"): the recipe image (`ShareImage`: headline
 *   numbers, every recipe section in the board's view with its osmolality,
 *   the recipe warnings). "Download" renders it to PNG with the lazily
 *   loaded `html-to-image` (on the page's surface colour), saves it, closes
 *   the dialog and confirms with a toast; while it works the button is
 *   `aria-disabled` and keeps focus, and a failure keeps the dialog open
 *   with focus on it. "Copy link" and "Back" as named.
 *
 * Switching views moves focus to the new view's main control (Download,
 * or "Make an image" when going back). Escape, the close button and a click
 * on the backdrop close the dialog; focus returns to the opener. Text and
 * units follow the UI prefs.
 */
export default function ShareDialog() {
  const t = useT();
  const plan = usePlan();
  const { inputs } = usePlanInputs();
  const { isModalOpen, closeModal, shareView, setShareView, showToast } = useUi();
  const open = isModalOpen(SHARE_MODAL);
  const imageView = shareView === "image";
  const cardRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const downloadRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
  const imageButtonRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
  const [busy, setBusy] = useState(false);
  // Guards against a second click before the busy state renders.
  const busyRef = useRef(false);
  const shownView = useRef({ open, view: shareView });

  // A view change while open moves focus into the new view (the button that
  // was pressed is gone).
  useEffect(() => {
    const before = shownView.current;
    shownView.current = { open, view: shareView };
    if (!open || !before.open || before.view === shareView) return;
    (shareView === "image" ? downloadRef : imageButtonRef).current?.focus();
  }, [open, shareView]);

  const copyLink = async () => {
    let copied = false;
    try {
      copied = await copyText(shareUrl(inputs));
    } catch {
      copied = false;
    }
    if (copied) {
      showToast(t("ui-dialogs.share.toast.copied"), { tone: "ok" });
      closeModal();
    } else {
      showToast(t("ui-dialogs.share.toast.copyFailed"), { tone: "danger" });
    }
  };

  const downloadImage = async () => {
    const node = cardRef.current;
    if (!node || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      // The card's own surface colour (light or dark theme), not a fixed one.
      const backgroundColor = window.getComputedStyle(node).backgroundColor || undefined;
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor });
      const link = document.createElement("a");
      link.download = t("ui-dialogs.share.fileName");
      link.href = dataUrl;
      link.click();
      showToast(t("ui-dialogs.share.toast.downloaded"), { tone: "ok" });
      closeModal();
    } catch (error) {
      console.error("Failed to generate image", error);
      showToast(t("ui-dialogs.share.toast.imageFailed"), { tone: "danger" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const footer = imageView ? (
    <>
      <Button variant="ghost" icon={ArrowLeft} onClick={() => setShareView("menu")} className="mr-auto">
        {t("ui-dialogs.share.back")}
      </Button>
      <Button icon={Link2} onClick={copyLink}>
        {t("ui-dialogs.share.copy")}
      </Button>
      {/* Busy, the button stays focusable (aria-disabled, clicks ignored), never `disabled`: disabling the
          focused button would drop focus to the page, and a failed image keeps the dialog open. */}
      <Button
        ref={downloadRef}
        variant="primary"
        icon={Download}
        onClick={downloadImage}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        className="aria-disabled:cursor-wait aria-disabled:opacity-50"
      >
        {t("ui-dialogs.share.download")}
      </Button>
    </>
  ) : null;

  return (
    <Dialog
      open={open}
      onClose={closeModal}
      title={imageView ? t("ui-dialogs.share.imageTitle") : t("ui-dialogs.share.title")}
      description={imageView ? undefined : t("ui-dialogs.share.description")}
      size={imageView ? "md" : "sm"}
      footer={footer}
      data-testid="share-dialog"
    >
      {imageView ? (
        <ShareImage plan={plan} view={inputs.format.view} bottleMl={inputs.format.bottleMl} cardRef={cardRef} />
      ) : (
        <ShareMenu onCopy={copyLink} onImage={() => setShareView("image")} imageButtonRef={imageButtonRef} />
      )}
    </Dialog>
  );
}
