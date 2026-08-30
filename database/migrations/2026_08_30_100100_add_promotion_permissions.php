<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const PERMISSIONS = [
        'promo.view',
        'promo.manage',
        'promo.manage.all',
        'promo.publish',
        'promo.send',
    ];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::PERMISSIONS as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        Role::query()->whereIn('name', ['admin', 'dev'])->each(function (Role $role): void {
            $role->givePermissionTo(self::PERMISSIONS);
        });

        Role::query()->where('name', 'commercial')->each(function (Role $role): void {
            $role->givePermissionTo(['promo.view', 'promo.manage']);
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::query()
            ->where('guard_name', 'web')
            ->whereIn('name', self::PERMISSIONS)
            ->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
