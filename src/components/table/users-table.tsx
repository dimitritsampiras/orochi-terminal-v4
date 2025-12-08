// "use client";

// import {
// 	Table,
// 	TableBody,
// 	TableCell,
// 	TableHead,
// 	TableHeader,
// 	TableRow,
// } from "@/components/ui/table";

// import {
// 	DropdownMenu,
// 	DropdownMenuContent,
// 	DropdownMenuItem,
// 	DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";

// import type { locations, userRoles, users } from "../../../drizzle/schema";
// import { Badge } from "../ui/badge";
// import { RoleBadge } from "@/components/badges/role-badge";
// import { buttonVariants } from "../ui/button";
// import { Icon } from "@iconify/react";
// import { ActiveStatusBadge } from "@/components/badges/active-status-badge";
// import { truncate } from "@/lib/utils";
// import { Checkbox } from "../ui/checkbox";
// import EditUserForm from "../forms/edit-user-form";
// import { useState } from "react";
// import ActivateUserForm from "../forms/activate-user-form";
// import type { CheckedState } from "@radix-ui/react-checkbox";

// type User = typeof users.$inferSelect & {
// 	locations?: Pick<typeof locations.$inferSelect, "name" | "id">[] | null;
// };

// function UsersTable({
// 	users,
// 	currentUserRole,
// 	locs,
// }: {
// 	users: User[];
// 	currentUserRole: (typeof userRoles.enumValues)[number];
// 	locs: (typeof locations.$inferSelect)[];
// }) {
// 	const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
// 	const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
// 	const [selectedUser, setSelectedUser] = useState<User | null>(null);
// 	const [selectedUserIds, setSelectedUserIds] = useState<User["id"][]>([]);

// 	const tableData = users.map((user) => ({
// 		name: `${user.firstName} ${user.lastName}`,
// 		contact: {
// 			value: user.email || user.phone,
// 			type: user.email ? "email" : "phone",
// 		},
// 		role: user.role,
// 		status: user.active,
// 		locations: user.locations,
// 		user,
// 	}));

// 	const handleSelect = (id: User["id"]) => {
// 		setSelectedUserIds((prev) =>
// 			prev.includes(id) ? prev.filter((userId) => userId !== id) : [...prev, id]
// 		);
// 	};

// 	const handleSelectAll = (checked: CheckedState) => {
// 		if (checked === true) {
// 			setSelectedUserIds(users.map((user) => user.id));
// 		} else {
// 			setSelectedUserIds([]);
// 		}
// 	};

// 	const handleEditUser = (user: User) => {
// 		setSelectedUser(user);
// 		setIsEditSheetOpen(true);
// 	};

// 	const handleDeactivateUser = (user: User) => {
// 		setSelectedUser(user);
// 		setIsDeactivateDialogOpen(true);
// 	};

// 	return (
// 		<>
// 			{selectedUser && (
// 				<EditUserForm
// 					isOpen={isEditSheetOpen}
// 					onOpenChange={setIsEditSheetOpen}
// 					locs={locs}
// 					currentUserRole={currentUserRole}
// 					user={selectedUser}
// 				/>
// 			)}

// 			{selectedUser && (
// 				<ActivateUserForm
// 					isOpen={isDeactivateDialogOpen}
// 					onOpenChange={setIsDeactivateDialogOpen}
// 					currentUserRole={currentUserRole}
// 					user={selectedUser}
// 				/>
// 			)}

// 			<div className="@container/table">
// 				<Table className="w-full">
// 					<TableHeader>
// 						<TableRow>
// 							<TableHead>
// 								<div className="flex items-center gap-4">
// 									<Checkbox
// 										checked={
// 											users.length > 0 &&
// 											selectedUserIds.length === users.length
// 												? true
// 												: selectedUserIds.length > 0
// 												? "indeterminate"
// 												: false
// 										}
// 										onCheckedChange={handleSelectAll}
// 									/>
// 									User
// 								</div>
// 							</TableHead>
// 							<TableHead>Contact</TableHead>
// 							<TableHead>Role</TableHead>
// 							<TableHead>Status</TableHead>
// 							<TableHead>Locations</TableHead>
// 							<TableHead>Actions</TableHead>
// 						</TableRow>
// 					</TableHeader>
// 					<TableBody>
// 						{tableData.length > 0 ? (
// 							tableData.map(
// 								({ name, contact, locations, role, status, user }) => (
// 									<TableRow key={user.id}>
// 										<TableCell className="font-semibold">
// 											<div className="flex items-center gap-4">
// 												<Checkbox
// 													checked={selectedUserIds.includes(user.id)}
// 													onCheckedChange={() => handleSelect(user.id)}
// 												/>
// 												{name}
// 											</div>
// 										</TableCell>
// 										<TableCell>
// 											<div className="flex items-center gap-2">
// 												<Icon
// 													icon={
// 														contact.type === "email"
// 															? "ph:envelope-simple"
// 															: "ph:phone"
// 													}
// 													className="size-4 text-zinc-500"
// 												/>
// 												<span className="text-zinc-600 text-sm">
// 													{contact.value ? truncate(contact.value, 27) : "none"}
// 												</span>
// 											</div>
// 										</TableCell>
// 										<TableCell>
// 											<RoleBadge role={role} />
// 										</TableCell>
// 										<TableCell>
// 											<ActiveStatusBadge
// 												active={status ? "active" : "inactive"}
// 											/>
// 										</TableCell>
// 										<TableCell>
// 											<div className="flex flex-wrap gap-2 max-w-[300px]">
// 												{locations && locations.length > 0 ? (
// 													locations.map((location) => {
// 														return (
// 															<Badge
// 																key={location.id}
// 																variant="outline"
// 																className="text-xs"
// 															>
// 																{location.name}
// 															</Badge>
// 														);
// 													})
// 												) : (
// 													<Badge variant="secondary">None</Badge>
// 												)}
// 											</div>
// 										</TableCell>
// 										<TableCell>
// 											<DropdownMenu>
// 												<DropdownMenuTrigger
// 													className={buttonVariants({
// 														variant: "outline",
// 														size: "icon-sm",
// 													})}
// 												>
// 													<Icon icon="ph:dots-three" />
// 												</DropdownMenuTrigger>
// 												<DropdownMenuContent>
// 													<DropdownMenuItem
// 														onClick={() => handleEditUser(user)}
// 													>
// 														<Icon icon="ph:pencil-simple" />
// 														Edit User
// 													</DropdownMenuItem>
// 													<DropdownMenuItem
// 														onClick={() => handleDeactivateUser(user)}
// 													>
// 														{user.active ? (
// 															<>
// 																<Icon
// 																	icon="ph:prohibit"
// 																	className="text-destructive"
// 																/>
// 																<span className="text-destructive hover:text-destructive">
// 																	Deactivate User
// 																</span>
// 															</>
// 														) : (
// 															<>
// 																<Icon
// 																	icon="ph:check-circle"
// 																	className="text-emerald-500 size-4"
// 																/>
// 																<span className="text-emerald-500 hover:text-emerald-500">
// 																	Activate User
// 																</span>
// 															</>
// 														)}
// 													</DropdownMenuItem>
// 												</DropdownMenuContent>
// 											</DropdownMenu>
// 										</TableCell>
// 									</TableRow>
// 								)
// 							)
// 						) : (
// 							<TableRow>
// 								<TableCell colSpan={6} className="text-center">
// 									<p className="text-sm text-muted-foreground py-4">
// 										No users found
// 									</p>
// 								</TableCell>
// 							</TableRow>
// 						)}
// 					</TableBody>
// 				</Table>
// 			</div>
// 		</>
// 	);
// }

// export { UsersTable };
