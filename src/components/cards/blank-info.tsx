import { blanks } from "@drizzle/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@iconify/react";

type Blank = typeof blanks.$inferSelect;

export function BlankInfoCard({ blank }: { blank: Blank }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Blank Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon icon="ph:buildings" className="text-muted-foreground" />
          <div>
            <div className="text-sm text-muted-foreground">Company</div>
            <div className="font-medium capitalize">{blank.blankCompany}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Icon icon="ph:t-shirt" className="text-muted-foreground" />
          <div>
            <div className="text-sm text-muted-foreground">Garment Type</div>
            <div className="font-medium capitalize">{blank.garmentType}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Icon icon="ph:currency-dollar" className="text-muted-foreground" />
          <div>
            <div className="text-sm text-muted-foreground">Customs Price</div>
            <div className="font-medium">${blank.customsPrice.toFixed(2)}</div>
          </div>
        </div>
        {blank.hsCode && (
          <div className="flex items-center gap-2">
            <Icon icon="ph:barcode" className="text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">HS Code</div>
              <div className="font-medium">{blank.hsCode}</div>
            </div>
          </div>
        )}
        {blank.links && blank.links.length > 0 && (
          <div className="flex items-start gap-2">
            <Icon icon="ph:link" className="text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm text-muted-foreground">Links</div>
              <div className="flex flex-col gap-1">
                {blank.links.map((link, i) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate max-w-[200px]"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

