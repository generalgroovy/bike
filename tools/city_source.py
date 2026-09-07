"""Read the fetcher's GeoJSON snapshots in bounded memory, including large features."""
import json

def iter_features(path, chunk_size=65536):
    prefix='{"type":"FeatureCollection","features":['
    decoder=json.JSONDecoder()
    with path.open(encoding='utf-8') as stream:
        if stream.read(len(prefix))!=prefix:
            raise ValueError(f'Unexpected snapshot format: {path}')
        buffer=''
        separator=False
        while True:
            buffer=buffer.lstrip()
            if not buffer:
                buffer=stream.read(chunk_size)
                if not buffer: raise ValueError(f'Truncated snapshot: {path}')
                continue
            if buffer.startswith(']'):
                if (buffer+stream.read()).strip()!=']}': raise ValueError(f'Unexpected snapshot tail: {path}')
                return
            if separator:
                if not buffer.startswith(','): raise ValueError(f'Missing feature separator: {path}')
                buffer=buffer[1:];separator=False
                continue
            try:
                feature,end=decoder.raw_decode(buffer)
            except json.JSONDecodeError:
                extra=stream.read(chunk_size)
                if not extra: raise
                buffer+=extra
                continue
            if not isinstance(feature,dict) or feature.get('type')!='Feature': raise ValueError('Invalid GeoJSON feature')
            yield feature
            buffer=buffer[end:];separator=True
