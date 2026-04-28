import { forwardRef } from "react";
import type {
  ChangeEvent,
  ComponentPropsWithoutRef,
  FormEvent,
  InvalidEvent,
} from "react";
import { Input } from "@/components/ui/input";
import {
  INDIAN_COUNTRY_CODE,
  INDIAN_PHONE_ERROR_MESSAGE,
  INDIAN_PHONE_LOCAL_LENGTH,
  INDIAN_PHONE_PLACEHOLDER,
  getIndianPhoneFieldError,
  getIndianPhoneInputValue,
  sanitizeIndianPhoneInput,
} from "@/lib/phone";

type IndianPhoneInputProps = Omit<
  ComponentPropsWithoutRef<typeof Input>,
  "defaultValue" | "inputMode" | "leadingContent" | "maxLength" | "minLength" | "pattern" | "placeholder" | "type" | "value"
> & {
  defaultValue?: string;
  placeholder?: string;
  validationMessage?: string;
  value?: string;
};

export const IndianPhoneInput = forwardRef<HTMLInputElement, IndianPhoneInputProps>(
  (
    {
      autoComplete = "tel-national",
      defaultValue,
      error,
      onChange,
      onInput,
      onInvalid,
      placeholder = INDIAN_PHONE_PLACEHOLDER,
      validationMessage = INDIAN_PHONE_ERROR_MESSAGE,
      value,
      ...props
    },
    ref,
  ) => {
    const resolvedValue = value !== undefined ? getIndianPhoneInputValue(value) : undefined;
    const resolvedDefaultValue =
      defaultValue !== undefined ? getIndianPhoneInputValue(defaultValue) : undefined;
    const derivedError =
      error ?? (resolvedValue !== undefined ? getIndianPhoneFieldError(resolvedValue, { message: validationMessage }) : undefined);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      event.target.setCustomValidity("");
      event.target.value = sanitizeIndianPhoneInput(event.target.value);
      onChange?.(event);
    };

    const handleInput = (event: FormEvent<HTMLInputElement>) => {
      event.currentTarget.setCustomValidity("");
      onInput?.(event);
    };

    const handleInvalid = (event: InvalidEvent<HTMLInputElement>) => {
      event.currentTarget.setCustomValidity(validationMessage);
      onInvalid?.(event);
    };

    return (
      <Input
        ref={ref}
        autoComplete={autoComplete}
        defaultValue={resolvedDefaultValue}
        error={derivedError}
        inputMode="numeric"
        leadingContent={
          <span className="text-sm font-semibold tracking-[0.08em] text-ink-soft">{INDIAN_COUNTRY_CODE}</span>
        }
        maxLength={INDIAN_PHONE_LOCAL_LENGTH}
        minLength={INDIAN_PHONE_LOCAL_LENGTH}
        onChange={handleChange}
        onInput={handleInput}
        onInvalid={handleInvalid}
        pattern="[6-9][0-9]{9}"
        placeholder={placeholder}
        type="tel"
        value={resolvedValue}
        {...props}
      />
    );
  },
);

IndianPhoneInput.displayName = "IndianPhoneInput";
