from backend.app.services.config_service import ConfigService


def test_config_load():
    cfg = ConfigService().load()
    assert "operation_mode" in cfg
    assert "endpoints" in cfg
    assert "models" in cfg

