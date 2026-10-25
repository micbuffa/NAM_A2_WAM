import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('summary', Path(__file__).resolve().parents[2] / 'tools/summarize-webnn-performance.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class SummaryTests(unittest.TestCase):
    def test_error_not_ranked_and_npu_label_remains_requested(self):
        report = {'runs': [{'model': 'roformer6', 'runtime': 'lab', 'backend': 'webnn', 'deviceType': 'npu', 'status': 'error', 'error': {'message': 'Unsupported operator'}, 'summary': {'firstMs': 123, 'warmMedianMs': 123, 'warmRtf': .1}}]}
        row = module.rows(report)[0]
        self.assertEqual(row[2], 'webnn / npu demandé')
        self.assertEqual(row[4:7], ['—', '—', '—'])
        self.assertEqual(row[7], 'Unsupported operator')

    def test_milliseconds_converted_to_seconds(self):
        row = module.rows({'runs': [{'model': 'demucs4', 'runtime': 'lab', 'runtimeVersion': '1.30.0', 'backend': 'webgpu', 'status': 'ok', 'sessionMs': 1200, 'summary': {'firstMs': 2700, 'warmMedianMs': 2400, 'warmRtf': .4}}]})[0]
        self.assertEqual(row[3:7], ['1.200', '2.700', '2.400', '0.400'])
