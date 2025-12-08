import CreateUserForm from "@/components/forms/create-user-form";
import { Search } from "@/components/inputs/search";

import { userRoles } from "../../../../drizzle/schema";

import { getUserOrSignout } from "@/lib/helpers/get-user-or-signout";
import { MultiSelectFilter } from "@/components/inputs/multi-select-filter";

import { UsersTable } from "@/components/table/users-table";

import type { GetLocationsResponse, GetUsersResponse } from "@/lib/types/misc";

import { env } from "@/lib/env";
import { cookies } from "next/headers";
import type { SearchParams } from "next/dist/server/request/search-params";

export default async function UsersPage({
	searchParams,
}: {
	searchParams: Promise<SearchParams>;
}) {
	const user = await getUserOrSignout();

	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(await searchParams)) {
		if (Array.isArray(value)) {
			value.forEach((v) => params.append(key, v));
		} else if (value) {
			params.append(key, value);
		}
	}

	const [{ data: locs }, { data: users }] = await Promise.all([
		fetch(`${env.SERVER_URL}/api/locations`).then(
			(res) => res.json() as Promise<GetLocationsResponse>
		),
		fetch(`${env.SERVER_URL}/api/users?${params.toString()}`, {
			headers: { Cookie: (await cookies()).toString() },
		}).then((res) => res.json() as Promise<GetUsersResponse>),
	]);

	return (
		<div>
			<h1 className="page-title">Users</h1>
			<div className="page-subtitle">Manage user accounts & permissions</div>
			<div className="mt-4 flex md:flex-row flex-col gap-4 justify-between items-start md:items-center">
				<div className="flex items-center gap-2">
					<Search placeholder="Search users" />
					<MultiSelectFilter
						options={userRoles.enumValues.map((role) => ({
							label: role.replace("_", " "),
							value: role,
						}))}
						queryParam="roles"
						title="Roles"
					/>
					<MultiSelectFilter
						options={[
							{ label: "Active", value: "active" },
							{ label: "Inactive", value: "inactive" },
						]}
						queryParam="status"
						title="Status"
					/>
				</div>
				<div>
					<CreateUserForm currentUserRole={user.role} locs={locs || []} />
				</div>
			</div>

			<div className="mt-4" />

			<UsersTable
				users={users || []}
				currentUserRole={user.role}
				locs={locs || []}
			/>
		</div>
	);
}
