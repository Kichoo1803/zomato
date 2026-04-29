import { forwardRef } from "react";
import type {
  ChangeEvent,
  ComponentPropsWithoutRef,
  FormEvent,
  InvalidEvent,
} from "react";
import { Input } from "@/components/ui/input";
import {
  INDIAN_LICENSE_NUMBER_ERROR_MESSAGE,
  getLicenseNumberFieldError,
  getLicenseNumberInputValue,
  sanitizeLicenseNumberInput,
} from "@/lib/vehicle";

type LicenseNumberInputProps = Omit<
  ComponentPropsWithoutRef<typeof Input>,
  "defaultValue" | "maxLength" | "pattern" | "type" | "value"
> & {
  defaultValue?: string;
  placeholder?: string;
  validationMessage?: string;
  value?: string;
};

export const LicenseNumberInput = forwardRef<HTMLInputElement, LicenseNumberInputProps>(
  (
    {
      autoComplete = "off",
      defaultValue,
      error,
      onChange,
      onInput,
      onInvalid,
      placeholder = "TN0120110012345",
      validationMessage = INDIAN_LICENSE_NUMBER_ERROR_MESSAGE,
      value,
      ...props
    },
    ref,
  ) => {
    const resolvedValue = value !== undefined ? getLicenseNumberInputValue(value) : undefined;
    const resolvedDefaultValue =
      defaultValue !== undefined ? getLicenseNumberInputValue(defaultValue) : undefined;
    const derivedError =
      error ??
      (resolvedValue !== undefined
        ? getLicenseNumberFieldError(resolvedValue, { message: validationMessage })
        : undefined);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      event.target.setCustomValidity("");
      event.target.value = sanitizeLicenseNumberInput(event.target.value);
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
        maxLength={20}
        onChange={handleChange}
        onInput={handleInput}
        onInvalid={handleInvalid}
        pattern="[A-Z0-9]{6,20}"
        placeholder={placeholder}
        spellCheck={false}
        type="text"
        value={resolvedValue}
        {...props}
      />
    );
  },
);

LicenseNumberInput.displayName = "LicenseNumberInput";
