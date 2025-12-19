"use client";

import { FSConnectedBadge } from "@/components/badges/fs-connected-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { useLocalServer } from "@/lib/hooks/use-local-server";
import { UpdateBlankVariantSchema } from "@/lib/schemas/product-schema";
import { LocalConfig } from "@/lib/types/misc";
import { cn, getProductDetailsForARXP, standardizePrintOrder } from "@/lib/utils";
import { blanks, blankVariants, prints, products, productVariants } from "@drizzle/schema";
import { Icon } from "@iconify/react";
import { index } from "drizzle-orm/cockroach-core";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ButtonProps } from "react-day-picker";
import { toast } from "sonner";

type Print = typeof prints.$inferSelect;

type PrintProductVariantFormProps = {
  productVariant: typeof productVariants.$inferSelect | undefined | null;
  blankVariant: typeof blankVariants.$inferSelect | undefined | null;
  blank: typeof blanks.$inferSelect | undefined | null;
  product: typeof products.$inferSelect | undefined | null;
  prints: Print[];
};

export const PrintProductVariantForm = ({
  productVariant,
  blankVariant,
  blank,
  product,
  prints,
}: PrintProductVariantFormProps) => {
  const { isConnected, config, checkFileExists, openFile } = useLocalServer();
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [selectedPrint, setSelecedPrint] = useState<Print | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const { trigger } = useFetcher<UpdateBlankVariantSchema>({
    path: `/api/blanks/${blank?.id}/blank-variants/${blankVariant?.id}`,
    method: "PATCH",
    successMessage: "Blank stock reduced by 1",
  });

  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [reduceStock, setReduceStock] = useState<boolean>(true);

  const standardizedPrints = standardizePrintOrder(prints);

  const arxpDetails = useMemo(() => {
    const printIndex = selectedPrint ? standardizedPrints.findIndex((print) => print.id === selectedPrint.id) : -1;
    // const printIndex = selectedPrint ? prints.findIndex((print) => print.id === selectedPrint.id) : -1;
    if (printIndex === -1) {
      return null;
    }

    const details = product && productVariant ? getProductDetailsForARXP(product, productVariant, printIndex) : null;

    return details;
  }, [selectedPrint, product, productVariant]);

  useEffect(() => {
    const verifyFile = async () => {
      if (!arxpDetails || !config.arxpFolderPath || !isConnected) {
        setFileExists(null);
        return;
      }

      try {
        const basePath = config.arxpFolderPath.replace(/\/$/, "");
        const fullPath = `${basePath}/${arxpDetails.path}`;
        const exists = await checkFileExists(fullPath);
        setFileExists(exists);
      } catch (e) {
        console.error("Failed to check file existence", e);
        setFileExists(false);
      }
    };

    verifyFile();
  }, [arxpDetails, config.arxpFolderPath, isConnected, checkFileExists]);

  const printFile = async () => {
    if (!blankVariant?.quantity) return;
    if (!blank?.id) return;
    if (!arxpDetails?.path) return;

    if (!config.arxpFolderPath || !isConnected) {
      return;
    }

    const basePath = config.arxpFolderPath.replace(/\/$/, "");
    const fullPath = `${basePath}/${arxpDetails.path}`;

    setIsPrinting(true);
    const openFileResult = await openFile(fullPath);
    if (openFileResult === "success") {
      if (reduceStock) {
        await trigger({ quantity: blankVariant?.quantity - 1 });
      } else {
        toast.success("File opened.");
      }
      setIsPrinting(false);
      setIsDialogOpen(false);
    } else {
      setIsPrinting(false);
      setIsDialogOpen(false);
      toast.error("Failed to open file");
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="fill" size="icon">
          <Icon icon="ph:printer" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Print {product?.title}: {productVariant?.title ?? "???"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col">
          {product?.isBlackLabel ? (
            <Alert variant="default" className="text-indigo-600">
              <Icon icon="ph:info" />
              <AlertTitle>Black label product</AlertTitle>
              <AlertDescription>
                <p>
                  This product is a premade, "black label" product. It is not synced to a blank. You cannot print this
                  product
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {!blankVariant && (
                <Alert variant="destructive">
                  <Icon icon="ph:warning-circle" />
                  <AlertTitle>
                    No blank synced for {product?.title}: {productVariant?.title}.
                  </AlertTitle>
                  <AlertDescription>
                    <p>
                      You can not print products that do not specify a blank. Please sync the variant on the product
                      page.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {!productVariant && (
                <Alert variant="destructive">
                  <Icon icon="ph:warning-circle" />
                  <AlertTitle>Couldn't find variant in database. Contact dev.</AlertTitle>
                  <AlertDescription>
                    <p>Weird error 🫠</p>
                  </AlertDescription>
                </Alert>
              )}

              {!isConnected && (
                <Alert variant="destructive">
                  <Icon icon="ph:warning-circle" />
                  <AlertTitle>You are not connected the file opener.</AlertTitle>
                  <AlertDescription>
                    <p>Either the file opener is not running, or the config is wrong</p>
                    <Link href="/settings" />
                  </AlertDescription>
                </Alert>
              )}

              {isConnected && blankVariant && (
                <div className="min-h-52 flex flex-col gap-4">
                  <div
                    className={cn(
                      "grid grid-cols-2 gap-2",
                      (() => {
                        const printCount = standardizedPrints.length;
                        const emptyBoxesNeeded = printCount === 1 || printCount === 3 ? 1 : 0;
                        const totalSlots = printCount + emptyBoxesNeeded;
                        return totalSlots <= 2 ? "grid-rows-1" : "grid-rows-2";
                      })()
                    )}
                  >
                    {(() => {
                      const printCount = standardizedPrints.length;
                      const emptyBoxesNeeded = printCount === 1 || printCount === 3 ? 1 : 0;
                      const totalSlots = printCount + emptyBoxesNeeded;

                      return Array.from({ length: totalSlots }, (_, index) => {
                        if (index < printCount) {
                          const print = standardizedPrints[index];
                          return (
                            <PrintSelector
                              className="h-18"
                              key={print.id}
                              print={{ ...print, printNumber: index + 1 }}
                              isSelected={selectedPrint?.id === print.id}
                              onClick={() => {
                                if (selectedPrint?.id === print.id) {
                                  setSelecedPrint(null);
                                } else {
                                  setSelecedPrint(print);
                                }
                              }}
                            />
                          );
                        } else {
                          return (
                            <div
                              key={`empty-${index}`}
                              className="w-full h-18 bg-zinc-200 rounded-md border border-zinc-300"
                            />
                          );
                        }
                      });
                    })()}
                  </div>
                  <div
                    className={cn(
                      "bg-zinc-50 rounded-lg p-4 h-full text-sm flex",
                      !arxpDetails && "items-center justify-center"
                    )}
                  >
                    {arxpDetails ? (
                      <div>
                        <div>
                          <span className="font-semibold">Base Name:</span> {arxpDetails.baseName}{" "}
                        </div>
                        <div>
                          <span className="font-semibold">Color:</span> {arxpDetails.color}{" "}
                        </div>
                        <div>
                          <span className="font-semibold">Size:</span> {arxpDetails.size}{" "}
                        </div>
                        <div className="flex flex-col gap-1">
                          <div>
                            <span className="font-semibold">File Path:</span>
                          </div>
                          <Kbd>{config.arxpFolderPath}</Kbd>
                          <div className="flex items-center gap-1">
                            <Kbd>{arxpDetails.path}</Kbd>
                            {fileExists ? (
                              <Badge variant="secondary" className="py-0.5 bg-emerald-50 text-emerald-700">
                                <div className="size-1 bg-emerald-600 rounded-full"></div>
                                File exists
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="py-0.5">
                                <div className="size-1 bg-red-600 rounded-full"></div>
                                Not found
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-zinc-500">select a print</div>
                    )}
                  </div>
                  {fileExists && arxpDetails && blank && (
                    <Alert variant="default">
                      {/* <Icon icon="ph:info" /> */}
                      <AlertTitle>
                        <div className="flex items-center space-x-2">
                          <Switch id="reduce-stock" checked={reduceStock} onCheckedChange={setReduceStock} />
                          {reduceStock ? <div>Print and reduce stock</div> : <div>Print only</div>}
                        </div>
                      </AlertTitle>
                      <AlertDescription className="min-h-12">
                        {reduceStock ? (
                          <p>
                            The blank {blank.blankCompany} {blank?.blankName} - {blankVariant.color} -{" "}
                            {blankVariant.size} will be reduced by 1 from its current inventory ({blankVariant.quantity}
                            ).
                          </p>
                        ) : (
                          <p>Printing will not reduce stock. Please ensure this is intentional.</p>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="flex justify-between! items-center">
          <FSConnectedBadge status={isConnected} />
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>

            <Button
              onClick={printFile}
              disabled={!blankVariant || !productVariant || !isConnected || Boolean(fileExists) === false}
              loading={isPrinting}
            >
              Open File & Print
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PrintSelector = ({
  print,
  className,
  isSelected,
  ...props
}: {
  className?: string;
  print: Print & {
    printNumber: number;
  };
  isSelected: boolean;
} & ButtonProps) => {
  return (
    <Button
      variant="outline"
      className={cn(
        "w-full h-full border-2 flex-col items-center justify-center gap-1!",
        isSelected && "border-blue-500! border-4! transition-all",
        className
      )}
      {...props}
    >
      <div>Print: {print.printNumber}</div>
      <div>Location: {print.location}</div>
      {print.heatTransferCode && <Badge variant="default">{print.heatTransferCode}</Badge>}
    </Button>
  );
};
