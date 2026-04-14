import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/page-shell";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerCombo, CustomerMenuItem } from "@/lib/customer";

type MenuItemSelection = {
  type: "MENU_ITEM";
  restaurantId: number;
  item: CustomerMenuItem;
};

type ComboSelection = {
  type: "COMBO";
  restaurantId: number;
  item: CustomerCombo;
};

export type CatalogItemSelection = MenuItemSelection | ComboSelection;

type CatalogItemModalProps = {
  open: boolean;
  selection: CatalogItemSelection | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    restaurantId: number;
    menuItemId?: number;
    comboId?: number;
    quantity: number;
    addonIds?: number[];
    specialInstructions?: string;
  }) => Promise<void> | void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export const CatalogItemModal = ({
  open,
  selection,
  isSubmitting,
  onClose,
  onSubmit,
}: CatalogItemModalProps) => {
  const [quantity, setQuantity] = useState("1");
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState("");

  useEffect(() => {
    if (!selection) {
      return;
    }

    setQuantity("1");
    setSelectedAddonIds([]);
    setSpecialInstructions("");
  }, [selection]);

  const basePrice = useMemo(() => {
    if (!selection) {
      return 0;
    }

    if (selection.type === "COMBO") {
      return selection.item.offerPrice ?? selection.item.basePrice;
    }

    return selection.item.discountPrice ?? selection.item.price;
  }, [selection]);

  const selectedAddons = useMemo(
    () =>
      selection?.item.addons.filter((addon) => selectedAddonIds.includes(addon.id)) ?? [],
    [selectedAddonIds, selection],
  );

  const totalPrice = useMemo(() => {
    const addonTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
    return (basePrice + addonTotal) * Number(quantity || "1");
  }, [basePrice, quantity, selectedAddons]);

  if (!selection) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={selection.item.name}
      className="max-w-3xl"
    >
      <div className="space-y-5">
        {selection.item.image ? (
          <div className="overflow-hidden rounded-[1.75rem]">
            <img
              src={selection.item.image}
              alt={selection.item.name}
              className="h-56 w-full object-cover"
            />
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label={selection.type === "COMBO" ? "Combo offer" : selection.item.foodType}
              tone="info"
            />
            {selection.type === "COMBO" && selection.item.categoryTag ? (
              <StatusPill label={selection.item.categoryTag} tone="neutral" />
            ) : null}
            {selection.type === "MENU_ITEM" && selection.item.isRecommended ? (
              <StatusPill label="Recommended" tone="neutral" />
            ) : null}
          </div>
          <p className="text-sm leading-7 text-ink-soft">
            {selection.item.description ?? "No description added yet."}
          </p>
        </div>

        {selection.type === "COMBO" ? (
          <div className="space-y-3 rounded-[1.75rem] bg-cream px-5 py-5">
            <p className="text-sm font-semibold text-ink">Included items</p>
            <div className="grid gap-3">
              {selection.item.items.map((comboItem) => (
                <div
                  key={`${comboItem.menuItem.id}-${comboItem.quantity}`}
                  className="flex items-center justify-between text-sm text-ink-soft"
                >
                  <span>{comboItem.menuItem.name}</span>
                  <span>x{comboItem.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selection.item.addons.length ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">Optional add-ons</p>
            <div className="grid gap-3">
              {selection.item.addons.map((addon) => {
                const isSelected = selectedAddonIds.includes(addon.id);

                return (
                  <label
                    key={addon.id}
                    className="flex items-start justify-between gap-3 rounded-[1.5rem] border border-accent/10 bg-white/70 px-4 py-4"
                  >
                    <div>
                      <p className="font-semibold text-ink">{addon.name}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {addon.description ?? addon.addonType.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-ink">
                        {formatCurrency(addon.price)}
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[rgb(139,30,36)]"
                        checked={isSelected}
                        onChange={(event) =>
                          setSelectedAddonIds((current) =>
                            event.target.checked
                              ? [...current, addon.id]
                              : current.filter((id) => id !== addon.id),
                          )
                        }
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <div className="rounded-[1.5rem] bg-cream px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Final price</p>
            <p className="mt-2 text-lg font-semibold text-ink">{formatCurrency(totalPrice)}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Base {formatCurrency(basePrice)} plus selected addons
            </p>
          </div>
        </div>

        <Textarea
          label="Special instructions"
          value={specialInstructions}
          onChange={(event) => setSpecialInstructions(event.target.value)}
          placeholder="Add any prep notes, packing requests, or handoff details"
        />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() =>
              void onSubmit({
                restaurantId: selection.restaurantId,
                quantity: Number(quantity || "1"),
                addonIds: selectedAddonIds,
                specialInstructions: specialInstructions.trim() || undefined,
                ...(selection.type === "COMBO"
                  ? { comboId: selection.item.id }
                  : { menuItemId: selection.item.id }),
              })
            }
          >
            {isSubmitting ? "Adding..." : "Add to cart"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
