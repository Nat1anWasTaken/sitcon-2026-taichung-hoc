"use server";

import { revalidatePath } from "next/cache";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminFirestore } from "@/lib/firebase-admin";
import { AgentKnowledgeDoc } from "@/lib/server/agent-types";
import { Timestamp } from "firebase-admin/firestore";

async function fetchDocs() {
    if (!adminFirestore) throw new Error("Missing admin credentials");
    const snap = await adminFirestore
        .collection("agentKnowledgeDocs")
        .orderBy("entityKey", "asc")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgentKnowledgeDoc, "id">) }));
}

async function createDoc(formData: FormData) {
    "use server";
    if (!adminFirestore) throw new Error("Missing admin credentials");
    const id = String(formData.get("id") ?? "").trim();
    const entityKey = String(formData.get("entityKey") ?? "").trim();
    const sourceTitle = String(formData.get("sourceTitle") ?? "");
    const sourceTier = (formData.get("sourceTier") as "trusted" | "untrusted") ?? "trusted";
    const content = String(formData.get("content") ?? "");
    const publishedAtStr = String(formData.get("publishedAt") ?? "");
    const publishedAt = publishedAtStr ? new Date(publishedAtStr) : new Date();
    const payload: AgentKnowledgeDoc = {
        id,
        entityKey,
        sourceTitle,
        sourceTier,
        publishedAt: Timestamp.fromDate(publishedAt),
        content,
        supersedesDocId: null,
        facts: null,
    };
    await adminFirestore!.collection("agentKnowledgeDocs").doc(id).set(payload, { merge: true });
    revalidatePath("/dashboard/agent/docs");
}

export default async function AgentDocsPage() {
    const docs = await fetchDocs();
    return (
        <div className="space-y-6">
            <Card className="border-4 border-foreground bg-secondary-background shadow-shadow">
                <CardHeader>
                    <CardTitle className="text-xl">Knowledge Docs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {docs.map((doc) => (
                        <div
                            key={doc.id}
                            className="rounded-md border-4 border-foreground bg-background px-3 py-2"
                        >
                            <div className="flex items-center justify-between">
                                <div className="font-semibold">{doc.id}</div>
                                <div className="text-xs">{doc.sourceTier}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">{doc.entityKey}</div>
                            <div className="text-sm line-clamp-2">{doc.content}</div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card className="border-4 border-foreground bg-background shadow-shadow">
                <CardHeader>
                    <CardTitle className="text-lg">Add knowledge doc</CardTitle>
                </CardHeader>
                <CardContent>
                    <form action={createDoc} className="space-y-3">
                        <div className="grid gap-2">
                            <Label htmlFor="id">Doc ID</Label>
                            <Input id="id" name="id" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="entityKey">Entity Key</Label>
                            <Input id="entityKey" name="entityKey" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sourceTitle">Source Title</Label>
                            <Input id="sourceTitle" name="sourceTitle" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sourceTier">Source Tier</Label>
                            <Input id="sourceTier" name="sourceTier" defaultValue="trusted" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="publishedAt">Published at</Label>
                            <Input id="publishedAt" name="publishedAt" type="date" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="content">Content</Label>
                            <Textarea id="content" name="content" rows={4} />
                        </div>
                        <button
                            type="submit"
                            className="rounded-md border-4 border-foreground bg-secondary px-3 py-2 text-sm font-semibold shadow-shadow"
                        >
                            Save
                        </button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
