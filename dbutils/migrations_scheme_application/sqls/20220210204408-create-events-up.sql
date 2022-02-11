CREATE PROCEDURE prune_msgs()
BEGIN
    DELETE LOW_PRIORITY FROM messages WHERE status_code = 'MS-105' OR status_code = 'MS-106';
END;


CREATE EVENT msgs_cleanup
    ON SCHEDULE AT CURRENT_TIMESTAMP + INTERVAL 10 MINUTE
    ON COMPLETION PRESERVE
    COMMENT 'Periodically clean up reviewed messages'
    DO
        CALL prune_msgs();
