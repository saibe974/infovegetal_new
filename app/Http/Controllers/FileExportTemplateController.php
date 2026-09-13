<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FileExportTemplateController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(DB::table('file_export_templates')
            ->where('user_id', $request->user()->id)->orderBy('id')->get()
            ->map(fn ($row) => ['id' => $row->client_id, 'format' => $row->format, 'template' => json_decode($row->template, true)]));
    }

    public function store(Request $request)
    {
        // A tab delimiter is meaningful, even though Laravel considers it blank.
        if ($request->input('template.delimiter') === "\t") {
            $request->merge(['template' => array_replace($request->input('template'), ['delimiter' => 'tab'])]);
        }
        $data = $request->validate([
            'id' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_-]+$/'],
            'format' => ['required', Rule::in(['csv', 'tsv', 'xlsx'])],
            'template' => ['required', 'array:name,filename,delimiter,blocks'],
            'template.name' => ['required', 'string', 'max:120'],
            'template.filename' => ['required', 'string', 'max:120'],
            'template.delimiter' => ['required', Rule::in([';', ',', 'tab', '|'])],
            'template.blocks' => ['required', 'array', 'min:1', 'max:5'],
            'template.blocks.*' => ['array:id,name,type,enabled,show_headers,columns,rows'],
            'template.blocks.*.id' => ['required', 'string', 'max:100', 'distinct'],
            'template.blocks.*.name' => ['required', 'string', 'max:120'],
            'template.blocks.*.type' => ['required', Rule::in(['header', 'items', 'footer'])],
            'template.blocks.*.enabled' => ['required', 'boolean'],
            'template.blocks.*.show_headers' => ['required', 'boolean'],
            'template.blocks.*.columns' => ['required', 'array', 'min:1', 'max:40'],
            'template.blocks.*.columns.*' => ['array:id,name'],
            'template.blocks.*.columns.*.id' => ['required', 'string', 'max:100'],
            'template.blocks.*.columns.*.name' => ['required', 'string', 'max:120'],
            'template.blocks.*.rows' => ['required', 'array', 'min:1', 'max:5'],
            'template.blocks.*.rows.*' => ['array:id,cells'],
            'template.blocks.*.rows.*.id' => ['required', 'string', 'max:100'],
            'template.blocks.*.rows.*.cells' => ['present', 'array', 'max:40'],
            'template.blocks.*.rows.*.cells.*' => ['nullable', 'string', 'max:1000'],
        ]);
        if ($data['template']['delimiter'] === 'tab') {
            $data['template']['delimiter'] = "\t";
        }
        foreach ($data['template']['blocks'] as &$block) {
            foreach ($block['rows'] as &$row) {
                $row['cells'] = array_map(fn ($value) => $value ?? '', $row['cells']);
            }
        }
        DB::table('file_export_templates')->upsert([[
            'user_id' => $request->user()->id,
            'client_id' => $data['id'],
            'format' => $data['format'],
            'template' => json_encode($data['template'], JSON_THROW_ON_ERROR),
            'created_at' => now(), 'updated_at' => now(),
        ]], ['user_id', 'client_id'], ['format', 'template', 'updated_at']);

        return response()->json($data);
    }

    public function destroy(Request $request, string $id)
    {
        DB::table('file_export_templates')->where('user_id', $request->user()->id)->where('client_id', $id)->delete();

        return response()->noContent();
    }
}
