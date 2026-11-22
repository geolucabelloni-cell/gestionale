import { startTransition, type FormEvent } from "react";

/**
 * Invia un form a un'azione di useActionState SENZA svuotare i campi.
 * (Con <form action={...}> React azzera il form a ogni invio, anche quando
 * il server restituisce un errore: l'utente perderebbe quanto ha scritto.)
 */
export function inviaSenzaReset(azione: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => azione(fd));
  };
}
