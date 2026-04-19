<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $actor = $request->user();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'alias' => $this->alias,
            'ref' => $this->ref,
            'phone' => $this->phone,
            'address_road' => $this->address_road,
            'address_zip' => $this->address_zip,
            'address_town' => $this->address_town,
            'active' => $this->active,
            'mailing' => $this->mailing,
            'email' => $this->email,
            'parent_id' => $this->parent_id,
            '_lft' => $this->_lft,
            '_rgt' => $this->_rgt,
            'roles' => $this->roles->map(fn($role) => [
                'id' => $role->id,
                'name' => $role->name,
            ]),
            'permissions' => $this->permissions->map(fn($permission) => [
                'id' => $permission->id,
                'name' => $permission->name,
            ]),
            'abilities' => $actor ? [
                'view' => $actor->can('view', $this->resource),
                'update' => $actor->can('update', $this->resource),
                'delete' => $actor->can('delete', $this->resource),
                'assign_roles' => $actor->can('assignRoles', $this->resource),
                'assign_permissions' => $actor->can('assignPermissions', $this->resource),
                'move' => $actor->can('move', $this->resource),
            ] : null,
        ];
    }
}
