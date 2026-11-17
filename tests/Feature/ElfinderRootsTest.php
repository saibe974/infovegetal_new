<?php

use App\Models\User;
use App\Support\ElfinderRoots;
use Illuminate\Support\Facades\File;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

function elfinderPaths(array $roots): array
{
    return array_map(fn ($root) => str_replace('\\', '/', $root['path']), $roots);
}

// Never touch the real storage folder: user ids in the test database collide with real ones.
beforeEach(function () {
    $this->realStoragePath = storage_path();
    $this->tempStorage = sys_get_temp_dir().DIRECTORY_SEPARATOR.'elfinder-roots-test-'.bin2hex(random_bytes(6));
    File::ensureDirectoryExists($this->tempStorage.'/app/public');
    File::ensureDirectoryExists($this->tempStorage.'/app/private');
    $this->app->useStoragePath($this->tempStorage);
});

afterEach(function () {
    $this->app->useStoragePath($this->realStoragePath);
    if (str_contains($this->tempStorage, 'elfinder-roots-test-')) {
        File::deleteDirectory($this->tempStorage);
    }
});

it('restricts a regular user to their own private and public user-meta folders, read-only', function () {
    $user = User::factory()->create();

    $roots = ElfinderRoots::forUser($user);

    expect(elfinderPaths($roots))->toBe([
        str_replace('\\', '/', storage_path('app/private/user-meta/'.$user->id)),
        str_replace('\\', '/', storage_path('app/public/user-meta/'.$user->id)),
    ]);
    foreach ($roots as $root) {
        expect($root['URL'])->toBe('')
            ->and($root['disabled'])->toContain('upload', 'mkdir', 'rename', 'rm', 'paste', 'cut');
    }
});

it('enables upload, rename and delete only when the matching permission is granted', function () {
    $user = User::factory()->create();
    foreach (ElfinderRoots::PERMISSIONS as $name) {
        Permission::findOrCreate($name, 'web');
    }
    $user->givePermissionTo(['media.upload', 'media.delete']);

    $disabled = ElfinderRoots::forUser($user->fresh())[0]['disabled'];

    expect($disabled)->toContain('rename', 'paste')
        ->not->toContain('upload')
        ->not->toContain('rm');
});

it('gives admins the public disk only and devs the private disk as well', function () {
    $admin = User::factory()->create();
    $admin->assignRole(Role::findOrCreate('admin', 'web'));
    $dev = User::factory()->create();
    $dev->assignRole(Role::findOrCreate('dev', 'web'));

    expect(elfinderPaths(ElfinderRoots::forUser($admin)))->toBe([str_replace('\\', '/', storage_path('app/public'))])
        ->and(elfinderPaths(ElfinderRoots::forUser($dev)))->toBe([
            str_replace('\\', '/', storage_path('app/public')),
            str_replace('\\', '/', storage_path('app/private')),
        ]);
});

it('lets any authenticated user open the personal media page and the elfinder connector', function () {
    $user = User::factory()->withoutTwoFactor()->create();

    $this->get('/media')->assertRedirect();
    $this->get('/elfinder/connector?cmd=open&init=1')->assertRedirect();

    $this->actingAs($user)->get('/media')->assertOk();
    $this->get('/admin/media-manager')->assertForbidden();
    // elFinder reads the PHP superglobals directly.
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_GET = ['cmd' => 'open', 'init' => '1', 'tree' => '1'];
    try {
        $response = $this->get('/elfinder/connector?cmd=open&init=1&tree=1')->assertOk();
    } finally {
        $_GET = [];
    }
    $volumes = collect($response->json('files'))->filter(fn ($f) => ! empty($f['isroot']))->pluck('name')->all();
    expect($volumes)->toEqualCanonicalizing(['Mes documents', 'Mes médias']);
});
