import { forwardRef } from "react";
import type {
  ChangeEvent,
  ComponentPropsWithoutRef,
  FormEvent,
  InvalidEvent,
} from "react";
import { Input } from "@/components/ui/input";
import {
  INDIAN_VEHICLE_NUMBER_ERROR_MESSAGE,
  getVehicleNumberFieldError,
  getVehicleNumberInputValue,
  sanitizeVehicleNumberInput,
} from "@/lib/vehicle";

type VehicleNumberInputProps = Omit<
  ComponentPropsWithoutRef<typeof Input>,
  "defaultValue" | "maxLength" | "pattern" | "type" | "value"
> & {
  defaultValue?: string;
  placeholder?: string;
  validationMessage?: string;
  value?: string;
};

export const VehicleNumberInput = forwardRef<HTMLInputElement, VehicleNumberInputProps>(
  (
    {
      autoComplete = "off",
      defaultValue,
      error,
      onChange,
      onInput,
      onInvalid,
      placeholder = "TN01AB1234",
      validationMessage = INDIAN_VEHICLE_NUMBER_ERROR_MESSAGE,
      value,
      ...props
    },
    ref,
  ) => {
    const resolvedValue = value !== undefined ? getVehicleNumberInputValue(value) : undefined;
    const resolvedDefaultValue =
      defaultValue !== undefined ? getVehicleNumberInputValue(defaultValue) : undefined;
    const derivedError =
      error ??
      (resolvedValue !== undefined
        ? getVehicleNumberFieldError(resolvedValue, { message: validationMessage })
        : undefined);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      event.target.setCustomValidity("");
      event.target.value = sanitizeVehicleNumberInput(event.target.value);
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
        maxLength={12}
        onChange={handleChange}
        onInput={handleInput}
        onInvalid={handleInvalid}
        pattern="([A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4})|([0-9]{2}BH[0-9]{4}[A-Z]{1,2})"
        placeholder={placeholder}
        spellCheck={false}
        type="text"
        value={resolvedValue}
        {...props}
      />
    );
  },
);

VehicleNumberInput.displayName = "VehicleNumberInput";
