export function LabeledField({ label, value }: { label: string; value: string }) {
    return (
        <p className="text-sm text-foreground">
            <span className="text-muted-foreground">{label}: </span>
            {value}
        </p>
    )
}
