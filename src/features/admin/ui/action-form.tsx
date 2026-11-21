"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormCtx = createContext<{ state: ActionState; pending: boolean }>({ state: initialActionState, pending: false });

export function useFormCtx() {
  return useContext(FormCtx);
}

/**
 * Form bound to a Server Action via useActionState. Submits through
 * startTransition (not the `action` prop) so React does not reset the fields
 * when validation fails — the user keeps their input.
 */
export function ActionForm({
  action,
  children,
  className,
  successMessage = "Kaydedildi.",
  resetOnSuccess = false,
  refreshOnSuccess = true,
  showErrorSummary = true,
  id,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  refreshOnSuccess?: boolean;
  showErrorSummary?: boolean;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const toast = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (state === initialActionState) return;
    if (state.ok) {
      toast(state.message ?? successMessage, "success");
      if (resetOnSuccess) formRef.current?.reset();
      if (refreshOnSuccess) router.refresh();
    } else if (state.message) {
      toast(state.message, "error");
    }
  }, [state, toast, successMessage, resetOnSuccess, refreshOnSuccess, router]);

  return (
    <FormCtx.Provider value={{ state, pending }}>
      <form
        id={id}
        ref={formRef}
        className={className}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter;
          const fd = new FormData(e.currentTarget, submitter instanceof HTMLElement ? submitter : null);
          startTransition(() => formAction(fd));
        }}
      >
        {showErrorSummary && !state.ok && state.errors && Object.keys(state.errors).length > 0 ? (
          <Alert tone="danger" className="mb-4" title={state.message ?? "Form hatalı"}>
            <ul className="list-disc pl-4">
              {Object.entries(state.errors).map(([k, v]) => (
                <li key={k}>{v?.[0]}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {children}
      </form>
    </FormCtx.Provider>
  );
}

function useError(name: string) {
  const { state } = useFormCtx();
  return state.ok ? undefined : state.errors?.[name];
}

export function FormSubmit({ children = "Kaydet", pendingLabel = "Kaydediliyor…", ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormCtx();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

type BaseProps = { name: string; label: ReactNode; hint?: ReactNode; className?: string };

export function TextField({ name, label, hint, className, ...input }: BaseProps & Omit<ComponentProps<"input">, "name">) {
  const error = useError(name);
  return (
    <Field name={name} label={label} hint={hint} error={error} className={className}>
      {(p) => <Input {...p} {...input} />}
    </Field>
  );
}

export function MoneyField(props: BaseProps & Omit<ComponentProps<"input">, "name">) {
  return <TextField inputMode="decimal" placeholder="0,00" autoComplete="off" hint={props.hint ?? "₺ — örn. 1299,90"} {...props} />;
}

export function TextAreaField({ name, label, hint, className, ...input }: BaseProps & Omit<ComponentProps<"textarea">, "name">) {
  const error = useError(name);
  return (
    <Field name={name} label={label} hint={hint} error={error} className={className}>
      {(p) => <Textarea {...p} {...input} />}
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  className,
  options,
  placeholder,
  ...select
}: BaseProps & Omit<ComponentProps<"select">, "name"> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const error = useError(name);
  return (
    <Field name={name} label={label} hint={hint} error={error} className={className}>
      {(p) => (
        <Select {...p} {...select}>
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function CheckboxField({ name, label, defaultChecked, className, value }: { name: string; label: ReactNode; defaultChecked?: boolean; className?: string; value?: string }) {
  return <Checkbox id={`f-${name}${value ? `-${value}` : ""}`} name={name} value={value ?? "on"} defaultChecked={defaultChecked} label={label} className={className} />;
}

/** TR + EN pair for a localized field. TR is labelled required when `requireTr`. */
export function LocalizedFields({
  base,
  label,
  values,
  multiline = false,
  requireTr = false,
  rows,
  maxLength,
  hint,
}: {
  base: string;
  label: string;
  values?: { tr?: string | null; en?: string | null } | null;
  multiline?: boolean;
  requireTr?: boolean;
  rows?: number;
  maxLength?: number;
  hint?: ReactNode;
}) {
  const Comp = multiline ? TextAreaField : TextField;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Comp
        name={`${base}_tr`}
        label={`${label} (TR)${requireTr ? " *" : ""}`}
        defaultValue={values?.tr ?? ""}
        maxLength={maxLength}
        hint={hint}
        {...(multiline ? { rows } : {})}
      />
      <Comp name={`${base}_en`} label={`${label} (EN)`} defaultValue={values?.en ?? ""} maxLength={maxLength} {...(multiline ? { rows } : {})} />
    </div>
  );
}

export function FormSection({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("rounded-sm border border-line bg-paper p-4 md:p-6", className)}>
      <legend className="px-1 font-display text-lg">{title}</legend>
      {description ? <p className="mb-4 text-sm text-muted">{description}</p> : null}
      <div className="grid gap-4">{children}</div>
    </fieldset>
  );
}
