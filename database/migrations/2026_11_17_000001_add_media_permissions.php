<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    // Grants a restricted user write actions inside their own user-meta/{id} folders.
    private const PERMISSIONS = ['media.upload', 'media.rename', 'media.delete'];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::PERMISSIONS as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        Role::query()->whereIn('name', ['admin', 'dev'])->each(function (Role $role): void {
            $role->givePermissionTo(self::PERMISSIONS);
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::query()->where('guard_name', 'web')->whereIn('name', self::PERMISSIONS)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
