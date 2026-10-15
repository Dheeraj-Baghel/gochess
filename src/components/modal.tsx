"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function Modal({ title, children, onClose, className = "" }: { title: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <div className="modal-inner"><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</div>
  </dialog>;
}