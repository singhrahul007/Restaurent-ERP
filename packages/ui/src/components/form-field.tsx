"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { cn } from "../lib/cn";
import { Input } from "./input";
import { Label } from "./label";

export function FormField({
  id,
  label,
  description,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  description?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {description ? (
        <p id={descriptionId} className="text-sm text-fg-muted">
          {description}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextFormField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...inputProps
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const descriptionId = description ? `${id}-description` : undefined;
        const errorId = fieldState.error ? `${id}-error` : undefined;
        return (
          <FormField
            id={id}
            label={label}
            description={description}
            error={fieldState.error?.message}
            className={className}
          >
            <Input
              {...field}
              {...inputProps}
              id={id}
              aria-invalid={fieldState.error ? true : undefined}
              aria-describedby={
                [descriptionId, errorId].filter(Boolean).join(" ") || undefined
              }
            />
          </FormField>
        );
      }}
    />
  );
}
